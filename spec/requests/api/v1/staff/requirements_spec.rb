require "spec_helper"

describe "API v1 staff requirements", type: :request do
  let!(:race) { FactoryBot.create(:race, time_zone: "America/Chicago") }
  let!(:fee) do
    FactoryBot.create(:payment_requirement, race: race, name: "Cart Deposit").tap do |requirement|
      FactoryBot.create(:tier, requirement: requirement, price: 10_000, begin_at: 2.weeks.ago)
      FactoryBot.create(:tier, requirement: requirement, price: 12_000, begin_at: 2.weeks.from_now)
    end
  end
  let(:operator) { FactoryBot.create(:operator_user) }
  let(:admin) { FactoryBot.create(:admin_user) }

  def pay(requirement, refunded: false)
    FactoryBot.create(:completed_requirement, requirement: requirement, team: FactoryBot.create(:team, race: requirement.race),
      charge_id: "ch_#{SecureRandom.hex(4)}", amount_cents: 10_000, refunded_at: (Time.current if refunded))
  end

  def create_params(requirement: {}, tier: {})
    { requirement: { name: "Late Fee", type: "PaymentRequirement" }.merge(requirement),
      tier: { price: 5000, begin_at: "2026-12-07T12:00" }.merge(tier) }
  end

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/races/#{race.id}/requirements"
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/staff/requirements/#{fee.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    %i[user refunder_user].each do |factory|
      it "is 403 for #{factory} on every action" do
        api_login(FactoryBot.create(factory))

        get "/api/v1/staff/races/#{race.id}/requirements"
        expect(response).to have_http_status(:forbidden)
        get "/api/v1/staff/requirements/#{fee.id}"
        expect(response).to have_http_status(:forbidden)
        expect do
          post "/api/v1/staff/races/#{race.id}/requirements", params: create_params, as: :json
          expect(response).to have_http_status(:forbidden)
        end.not_to change(Requirement, :count)
        patch "/api/v1/staff/requirements/#{fee.id}", params: { requirement: { name: "Hacked" } }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(fee.reload.name).to eq("Cart Deposit")
        delete "/api/v1/staff/requirements/#{fee.id}", as: :json
        expect(response).to have_http_status(:forbidden)
        expect(Requirement.exists?(fee.id)).to be true
      end
    end
  end

  describe "a refunder" do
    before { api_login(FactoryBot.create(:refunder_user)) }

    it "gets 403, not 400 or 404, for a malformed body or an unknown race" do
      post "/api/v1/staff/races/#{race.id}/requirements", params: { requirement: { name: "x" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      post "/api/v1/staff/races/0/requirements", params: create_params, as: :json
      expect(response).to have_http_status(:forbidden)
      get "/api/v1/staff/races/0/requirements"
      expect(response).to have_http_status(:forbidden)
    end

    it "gets 403, not 404, for an unknown fee on show, update and destroy" do
      get "/api/v1/staff/requirements/0"
      expect(response).to have_http_status(:forbidden)
      patch "/api/v1/staff/requirements/0", params: { requirement: { name: "x" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      delete "/api/v1/staff/requirements/0", as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/staff/races/:race_id/requirements" do
    before { api_login(operator) }

    it "lists the race's fees with their prices, statuses and paid counts" do
      pay(fee)
      pay(fee, refunded: true)
      FactoryBot.create(:payment_requirement, race: FactoryBot.create(:race), name: "Other race")
      get "/api/v1/staff/races/#{race.id}/requirements"

      expect(response).to have_http_status(:ok)
      expect(json["race"]).to eq("id" => race.id, "name" => race.name, "time_zone" => "America/Chicago",
        "registration_open" => json["race"]["registration_open"])
      expect(Time.zone.parse(json["race"]["registration_open"])).to be_within(1.second).of(race.registration_open)
      expect(json["types"]).to include("PaymentRequirement")
      expect(json["requirements"].size).to eq(1)
      listed = json["requirements"].first
      expect(listed).to include("id" => fee.id, "race_id" => race.id, "name" => "Cart Deposit", "type" => "PaymentRequirement",
        "enabled" => true, "paid_team_count" => 1, "can_destroy" => false)
      expect(listed["current_tier"]["price_cents"]).to eq(10_000)
      expect(listed["next_tier"]["price_cents"]).to eq(12_000)
      expect(listed["tiers"].map { |tier| tier["status"] }).to eq(%w[current next])
      expect(listed["tiers"].map { |tier| tier["price_cents"] }).to eq([10_000, 12_000])
      expect(listed["destroy_blocked_reason"]).to eq("Can't delete: 1 team has paid it.")
    end

    it "marks a price that has been replaced as past and later ones as later" do
      FactoryBot.create(:tier, requirement: fee, price: 11_000, begin_at: 1.week.ago)
      FactoryBot.create(:tier, requirement: fee, price: 13_000, begin_at: 4.weeks.from_now)
      get "/api/v1/staff/races/#{race.id}/requirements"

      expect(json["requirements"].first["tiers"].map { |tier| tier["status"] }).to eq(%w[past current next later])
    end

    it "gives a fee with no price started yet no current price" do
      empty = FactoryBot.create(:payment_requirement, race: race, name: "Empty")
      FactoryBot.create(:tier, requirement: empty, price: 3000, begin_at: 1.week.from_now)
      get "/api/v1/staff/races/#{race.id}/requirements"

      listed = json["requirements"].find { |requirement| requirement["id"] == empty.id }
      expect(listed).to include("enabled" => false, "current_tier" => nil)
      expect(listed["next_tier"]["price_cents"]).to eq(3000)
    end

    it "is 404 for an unknown race" do
      get "/api/v1/staff/races/0/requirements"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/staff/requirements/:id" do
    before { api_login(operator) }

    it "shows the fee and its race" do
      get "/api/v1/staff/requirements/#{fee.id}"

      expect(response).to have_http_status(:ok)
      expect(json["requirement"]).to include("id" => fee.id, "name" => "Cart Deposit", "paid_team_count" => 0,
        "can_destroy" => false, "destroy_blocked_reason" => nil)
      expect(json["race"]).to include("id" => race.id, "time_zone" => "America/Chicago")
    end

    it "tells a paid fee's only price it cannot be deleted" do
      only = FactoryBot.create(:payment_requirement, race: race)
      FactoryBot.create(:tier, requirement: only, price: 4000)
      pay(only)
      get "/api/v1/staff/requirements/#{only.id}"

      tier = json["requirement"]["tiers"].first
      expect(tier["destroy_blocked_reason"]).to eq("Can't delete the only price of a fee teams have paid.")
      expect(tier["can_destroy"]).to be false
    end

    it "tells a paid fee's only dated price it cannot be deleted even with an undated one beside it" do
      only = FactoryBot.create(:payment_requirement, race: race)
      FactoryBot.create(:tier, requirement: only, price: 4000)
      Tier.new(requirement: only, price: 5000, begin_at: nil).save(validate: false)
      pay(only)
      get "/api/v1/staff/requirements/#{only.id}"

      tiers = json["requirement"]["tiers"]
      expect(tiers.size).to eq(1)
      expect(tiers.first["destroy_blocked_reason"]).to eq("Can't delete the only price of a fee teams have paid.")
    end

    it "is 404 for a requirement that is not a payment" do
      other = Requirement.new(name: "Other", race: race)
      other.save!(validate: false)
      get "/api/v1/staff/requirements/#{other.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/staff/races/:race_id/requirements" do
    before { api_login(operator) }

    it "creates the fee and its first price in the race's zone" do
      expect do
        post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(tier: { begin_at: "2026-12-07T12:00" }), as: :json
      end.to change(Requirement, :count).by(1).and change(Tier, :count).by(1)

      expect(response).to have_http_status(:created)
      created = PaymentRequirement.find(json["requirement"]["id"])
      expect(created).to have_attributes(name: "Late Fee", race_id: race.id)
      expect(created.tiers.first.price).to eq(5000)
      expect(created.tiers.first.begin_at).to eq(ActiveSupport::TimeZone["America/Chicago"].parse("2026-12-07 12:00"))
      expect(json["requirement"]["tiers"].size).to eq(1)
      expect(json["race"]["id"]).to eq(race.id)
    end

    it "refuses a price that is not whole dollars and creates nothing" do
      [5050, 50, 0, "5000", nil, 5000.5].each do |price|
        expect do
          post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(tier: { price: price }), as: :json
        end.not_to change(Requirement, :count)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["tier.price"]).to eq(["Whole dollars only, $1 or more."])
      end
      expect(Tier.count).to eq(2)
    end

    it "refuses a price over $100,000 instead of failing on the integer column" do
      [10_000_100, 3_000_000_000_000].each do |price|
        expect do
          post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(tier: { price: price }), as: :json
        end.not_to change(Requirement, :count)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["tier.price"]).to eq(["Must be $100,000 or less."])
      end

      post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(tier: { price: 10_000_000 }), as: :json
      expect(response).to have_http_status(:created)
    end

    it "refuses a blank name and creates no price" do
      expect do
        post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(requirement: { name: "" }), as: :json
      end.not_to change(Tier, :count)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["name"]).to be_present
    end

    it "refuses an unknown type" do
      expect do
        post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(requirement: { type: "Bogus" }), as: :json
      end.not_to change(Requirement, :count)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["type"]).to eq(["Choose a type"])
    end

    it "reports a bad start time under tier.begin_at" do
      %w[tomorrow].push("", nil).each do |begin_at|
        post "/api/v1/staff/races/#{race.id}/requirements", params: create_params(tier: { begin_at: begin_at }), as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["tier.begin_at"]).to be_present
      end
      expect(Requirement.where(name: "Late Fee")).to be_empty
    end

    it "reports everything wrong at once" do
      post "/api/v1/staff/races/#{race.id}/requirements",
        params: create_params(requirement: { name: "" }, tier: { price: 5050, begin_at: "nope" }), as: :json

      expect(json["errors"].keys).to match_array(%w[name tier.price tier.begin_at])
    end

    it "is 400 without the tier" do
      post "/api/v1/staff/races/#{race.id}/requirements", params: { requirement: { name: "x", type: "PaymentRequirement" } }, as: :json
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "PATCH /api/v1/staff/requirements/:id" do
    before { api_login(operator) }

    it "renames the fee" do
      patch "/api/v1/staff/requirements/#{fee.id}", params: { requirement: { name: "Cart Rental" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(fee.reload.name).to eq("Cart Rental")
      expect(json["requirement"]["name"]).to eq("Cart Rental")
    end

    it "refuses a blank name" do
      patch "/api/v1/staff/requirements/#{fee.id}", params: { requirement: { name: "" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["name"]).to be_present
      expect(fee.reload.name).to eq("Cart Deposit")
    end

    it "refuses to change the type" do
      patch "/api/v1/staff/requirements/#{fee.id}", params: { requirement: { name: "Renamed", type: "MockPaymentRequirement" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["type"]).to eq(["can't be changed after the fee is created"])
      expect(Requirement.find(fee.id)).to have_attributes(type: "PaymentRequirement", name: "Cart Deposit")
    end
  end

  describe "DELETE /api/v1/staff/requirements/:id" do
    it "is forbidden for operators" do
      api_login(operator)
      delete "/api/v1/staff/requirements/#{fee.id}", as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Requirement.exists?(fee.id)).to be true
    end

    it "lets an admin delete an unpaid fee and its prices" do
      api_login(admin)
      expect { delete "/api/v1/staff/requirements/#{fee.id}", as: :json }.to change(Tier, :count).by(-2)

      expect(response).to have_http_status(:no_content)
      expect(Requirement.exists?(fee.id)).to be false
    end

    it "refuses an admin deleting a paid fee" do
      pay(fee)
      api_login(admin)
      expect { delete "/api/v1/staff/requirements/#{fee.id}", as: :json }.not_to change(Tier, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("fee_has_payments")
      expect(json["error"]).to eq("Can't delete: 1 team has paid it.")
      expect(Requirement.exists?(fee.id)).to be true
    end

    it "shows the admin the delete button as allowed" do
      api_login(admin)
      get "/api/v1/staff/requirements/#{fee.id}"

      expect(json["requirement"]["can_destroy"]).to be true
    end
  end
end
