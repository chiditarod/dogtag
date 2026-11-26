require "spec_helper"

describe "API v1 staff races", type: :request do
  let!(:older) { FactoryBot.create(:race, name: "Older Race", race_datetime: 3.weeks.from_now + 1.day) }
  let!(:newer) { FactoryBot.create(:race, name: "Newer Race", race_datetime: 8.weeks.from_now) }

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/races"
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/staff/races/#{newer.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    %i[user refunder_user].each do |factory|
      it "is 403 for #{factory}" do
        api_login(FactoryBot.create(factory))
        get "/api/v1/staff/races"
        expect(response).to have_http_status(:forbidden)
        expect(json["races"]).to be_nil
        get "/api/v1/staff/races/#{newer.id}"
        expect(response).to have_http_status(:forbidden)
        expect(json["race"]).to be_nil
      end
    end
  end

  describe "GET /api/v1/staff/races" do
    before { api_login(FactoryBot.create(:operator_user)) }

    it "lists races newest race date first with team counts and setup problems" do
      FactoryBot.create(:finalized_team, race: newer)
      FactoryBot.create(:team, race: newer)
      get "/api/v1/staff/races"

      expect(response).to have_http_status(:ok)
      expect(json["races"].map { |race| race["name"] }).to eq(["Newer Race", "Older Race"])
      first, second = json["races"]
      expect(first).to include("id" => newer.id, "time_zone" => "America/Chicago", "registration_status" => "open",
        "teams" => { "finalized" => 1, "total" => 2 })
      expect(Time.zone.parse(first["race_datetime"])).to be_within(1.second).of(newer.race_datetime)
      expect(first["setup_problems"]).to eq(["No fee set up"])
      expect(second["teams"]).to eq("finalized" => 0, "total" => 0)
      expect(first.keys).to match_array(%w[id name race_datetime registration_open registration_close final_edits_close
        time_zone registration_status teams setup_problems])
    end
  end

  describe "GET /api/v1/staff/races/:id" do
    let(:jsonform) { File.read(Rails.root.join("spec/fixtures/files/valid_jsonform.json")) }
    let!(:race) do
      FactoryBot.create(:race, :with_classy_data, jsonform:, filter_field: "a,b", experience_labels: ["Newbie", "Vet"],
        confirmation_text: "# Hi", max_teams: 4)
    end
    let!(:fee) { FactoryBot.create(:payment_requirement_with_tier, race:, name: "Entry Fee") }
    let!(:finalized) { FactoryBot.create(:finalized_team, race:) }
    let!(:pending) { FactoryBot.create(:team, race:) }

    before do
      finalized.update_column(:finalized, true) # the fee is unpaid, so the factory's own finalize refused
      FactoryBot.create(:completed_requirement, requirement: fee, team: finalized, amount_cents: 5000, charge_id: "ch_1")
      refunded = FactoryBot.create(:completed_requirement, requirement: fee, team: pending, amount_cents: 2000, charge_id: "ch_2")
      refunded.update_columns(refunded_at: Time.current)
    end

    it "returns the full race with the jsonform as stored text" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/races/#{race.id}"

      expect(response).to have_http_status(:ok)
      body = json["race"]
      expect(body["jsonform"]).to eq(jsonform)
      expect(body).to include("max_teams" => 4, "people_per_team" => 2, "full" => false, "filter_field" => %w[a b],
        "experience_labels_text" => "Newbie\nVet", "classy_campaign_id" => 12_345, "classy_default_goal" => 2000,
        "confirmation_text" => "# Hi", "confirmation_text_max_length" => Race::CONFIRMATION_TEXT_MAX_LENGTH,
        "money" => { "gross_cents" => 7000, "refunded_cents" => 2000, "net_cents" => 5000 },
        "teams" => { "finalized" => 1, "total" => 2, "registering" => 1 },
        "racer_emails" => finalized.people.map(&:email).uniq.sort,
        "setup_problems" => ["Entry Fee has no price when registration opens"], "can_destroy" => false, "has_teams" => true)
      expect(body["racer_emails"]).not_to be_empty
      expect(body["payment_requirements"]).to eq([{ "id" => fee.id, "name" => "Entry Fee", "type" => "PaymentRequirement",
        "enabled" => true, "current_price_cents" => fee.active_tier.price, "tier_count" => 1 }])
    end

    it "lets an admin destroy" do
      api_login(FactoryBot.create(:admin_user))
      get "/api/v1/staff/races/#{race.id}"

      expect(json["race"]["can_destroy"]).to be(true)
    end

    it "has a null price for a fee with no tier yet and no teams on a bare race" do
      api_login(FactoryBot.create(:operator_user))
      bare = FactoryBot.create(:race)
      FactoryBot.create(:payment_requirement, race: bare, name: "Soon")
      get "/api/v1/staff/races/#{bare.id}"

      expect(json["race"]["has_teams"]).to be(false)
      expect(json["race"]["payment_requirements"].first).to include("enabled" => false, "current_price_cents" => nil, "tier_count" => 0)
      expect(json["race"]["money"]).to eq("gross_cents" => 0, "refunded_cents" => 0, "net_cents" => 0)
    end

    it "is 404 for an unknown id" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/races/0"

      expect(response).to have_http_status(:not_found)
    end
  end
end
