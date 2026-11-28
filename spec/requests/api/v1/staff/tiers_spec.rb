require "spec_helper"

describe "API v1 staff tiers", type: :request do
  let!(:race) { FactoryBot.create(:race, time_zone: "America/Chicago") }
  let!(:fee) { FactoryBot.create(:payment_requirement, race: race, name: "Cart Deposit") }
  let!(:early) { FactoryBot.create(:tier, requirement: fee, price: 10_000, begin_at: 2.weeks.ago) }
  let!(:late) { FactoryBot.create(:tier, requirement: fee, price: 12_000, begin_at: 2.weeks.from_now) }
  let(:operator) { FactoryBot.create(:operator_user) }
  let(:admin) { FactoryBot.create(:admin_user) }
  let(:chicago) { ActiveSupport::TimeZone["America/Chicago"] }

  def pay(requirement)
    FactoryBot.create(:completed_requirement, requirement: requirement, team: FactoryBot.create(:team, race: requirement.race),
      charge_id: "ch_#{SecureRandom.hex(4)}", amount_cents: 10_000)
  end

  def create_tier(requirement: fee, **tier)
    post "/api/v1/staff/requirements/#{requirement.id}/tiers",
      params: { tier: { price: 14_000, begin_at: "2027-02-01T00:00" }.merge(tier) }, as: :json
  end

  describe "authorization" do
    it "is 401 when logged out" do
      create_tier
      expect(response).to have_http_status(:unauthorized)
    end

    %i[user refunder_user].each do |factory|
      it "is 403 for #{factory} on every action, whatever the body or ids" do
        api_login(FactoryBot.create(factory))

        expect { create_tier }.not_to change(Tier, :count)
        expect(response).to have_http_status(:forbidden)
        post "/api/v1/staff/requirements/#{fee.id}/tiers", params: { nope: 1 }, as: :json
        expect(response).to have_http_status(:forbidden)
        post "/api/v1/staff/requirements/0/tiers", params: { tier: { price: 5000 } }, as: :json
        expect(response).to have_http_status(:forbidden)
        patch "/api/v1/staff/tiers/#{early.id}", params: { tier: { price: 15_000 } }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(early.reload.price).to eq(10_000)
        patch "/api/v1/staff/tiers/0", params: { nope: 1 }, as: :json
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/staff/tiers/#{early.id}", as: :json
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/staff/tiers/0", as: :json
        expect(response).to have_http_status(:forbidden)
        expect(Tier.exists?(early.id)).to be true
      end
    end

    it "keeps operators from deleting a price" do
      api_login(operator)
      expect { delete "/api/v1/staff/tiers/#{early.id}", as: :json }.not_to change(Tier, :count)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/staff/requirements/:requirement_id/tiers" do
    before { api_login(operator) }

    it "adds a price starting at midnight in the race's zone and answers with the fee" do
      expect { create_tier }.to change(Tier, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(Tier.order(:id).last).to have_attributes(price: 14_000, begin_at: chicago.parse("2027-02-01 00:00"))
      expect(json["requirement"]).to include("id" => fee.id)
      expect(json["requirement"]["tiers"].size).to eq(3)
      expect(json["requirement"]["tiers"].map { |tier| tier["price_cents"] }).to eq([10_000, 12_000, 14_000])
      expect(json["race"]).to include("id" => race.id, "time_zone" => "America/Chicago")
    end

    it "refuses a start in the hour the clocks skip" do
      expect { create_tier(begin_at: "2027-03-14T02:30") }.not_to change(Tier, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["begin_at"].first).to include("doesn't exist in America/Chicago")
    end

    it "refuses an unreadable or missing start" do
      ["tomorrow", "", nil].each do |begin_at|
        create_tier(begin_at: begin_at)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["begin_at"]).to be_present
      end
    end

    it "refuses a price another price on the fee already has" do
      expect { create_tier(price: 10_000) }.not_to change(Tier, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["price"]).to eq(["is already used by another price on this fee"])
    end

    it "refuses a start another price on the fee already has" do
      late.update_columns(begin_at: chicago.parse("2027-04-01 08:00"))
      create_tier(begin_at: "2027-04-01T08:00")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["begin_at"]).to eq(["is already used by another price on this fee"])
    end

    it "refuses prices that are not whole dollars" do
      [50, 14_050, 0, "14000", nil, 14_000.5].each do |price|
        create_tier(price: price)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["price"]).to eq(["Whole dollars only, $1 or more."])
      end
      expect(Tier.count).to eq(2)
    end

    it "refuses a price over $100,000 instead of failing on the integer column" do
      [10_000_100, 3_000_000_000_000].each do |price|
        create_tier(price: price)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["price"]).to eq(["Must be $100,000 or less."])
      end

      create_tier(price: 10_000_000)
      expect(response).to have_http_status(:created)
    end

    it "reports a bad price and a bad start together" do
      create_tier(price: 50, begin_at: "nope")

      expect(json["errors"].keys).to match_array(%w[price begin_at])
    end

    it "is 400 without the tier and 404 for an unknown or non-fee requirement" do
      post "/api/v1/staff/requirements/#{fee.id}/tiers", params: { nope: 5000 }, as: :json
      expect(response).to have_http_status(:bad_request)
      create_tier(requirement: Struct.new(:id).new(0))
      expect(response).to have_http_status(:not_found)
      other = Requirement.new(name: "Other", race: race).tap { |requirement| requirement.save!(validate: false) }
      create_tier(requirement: other)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/staff/tiers/:id" do
    before { api_login(operator) }

    it "changes only the price and leaves a start with seconds untouched" do
      seconds = Time.zone.parse("2027-05-01 12:00:17 UTC")
      early.update_columns(begin_at: seconds)
      patch "/api/v1/staff/tiers/#{early.id}", params: { tier: { price: 15_000 } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(early.reload.price).to eq(15_000)
      expect(early.begin_at.to_f).to eq(seconds.to_f)
      expect(json["requirement"]["tiers"].map { |tier| tier["price_cents"] }).to include(15_000)
    end

    it "changes only the start, read in the race's zone" do
      patch "/api/v1/staff/tiers/#{late.id}", params: { tier: { begin_at: "2027-07-01T09:30" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(late.reload).to have_attributes(price: 12_000, begin_at: chicago.parse("2027-07-01 09:30"))
    end

    it "refuses a change the model refuses and keeps the price" do
      patch "/api/v1/staff/tiers/#{early.id}", params: { tier: { price: 12_000 } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["price"]).to eq(["is already used by another price on this fee"])
      expect(early.reload.price).to eq(10_000)
    end

    it "refuses prices that are not whole dollars or over $100,000" do
      { 10_050 => "Whole dollars only, $1 or more.", 50 => "Whole dollars only, $1 or more.", nil => "Whole dollars only, $1 or more.",
        10_000_100 => "Must be $100,000 or less." }.each do |price, message|
        patch "/api/v1/staff/tiers/#{early.id}", params: { tier: { price: price } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["price"]).to eq([message])
      end
      expect(early.reload.price).to eq(10_000)
    end

    it "refuses a start that cannot be read" do
      patch "/api/v1/staff/tiers/#{early.id}", params: { tier: { begin_at: "2027-03-14T02:30" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["begin_at"]).to be_present
    end

    it "is 400 without the tier and 404 for an unknown price" do
      patch "/api/v1/staff/tiers/#{early.id}", params: { nope: 1 }, as: :json
      expect(response).to have_http_status(:bad_request)
      patch "/api/v1/staff/tiers/0", params: { tier: { price: 5000 } }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/staff/tiers/:id" do
    before { api_login(admin) }

    it "deletes one of two prices and answers with the fee" do
      pay(fee)
      expect { delete "/api/v1/staff/tiers/#{early.id}", as: :json }.to change(Tier, :count).by(-1)

      expect(response).to have_http_status(:ok)
      expect(json["requirement"]["tiers"].map { |tier| tier["id"] }).to eq([late.id])
      expect(json["race"]["id"]).to eq(race.id)
    end

    it "refuses the only price of a paid fee" do
      only = FactoryBot.create(:payment_requirement, race: race)
      tier = FactoryBot.create(:tier, requirement: only, price: 4000)
      pay(only)
      expect { delete "/api/v1/staff/tiers/#{tier.id}", as: :json }.not_to change(Tier, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("only_price_of_paid_fee")
      expect(json["error"]).to eq("Can't delete the only price of a fee teams have paid.")
    end

    it "counts only priced-with-a-start tiers: a paid fee's one dated price stays beside an undated one" do
      only = FactoryBot.create(:payment_requirement, race: race)
      tier = FactoryBot.create(:tier, requirement: only, price: 4000)
      Tier.new(requirement: only, price: 5000, begin_at: nil).save(validate: false)
      pay(only)
      expect { delete "/api/v1/staff/tiers/#{tier.id}", as: :json }.not_to change(Tier, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("only_price_of_paid_fee")
    end

    it "lets the only price of an unpaid fee go" do
      only = FactoryBot.create(:payment_requirement, race: race)
      tier = FactoryBot.create(:tier, requirement: only, price: 4000)

      expect { delete "/api/v1/staff/tiers/#{tier.id}", as: :json }.to change(Tier, :count).by(-1)
      expect(response).to have_http_status(:ok)
      expect(json["requirement"]["tiers"]).to eq([])
    end

    it "is 404 for an unknown price" do
      delete "/api/v1/staff/tiers/0", as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
