require "spec_helper"

describe "API v1 races", type: :request do
  let!(:race) { FactoryBot.create(:race_with_jsonform, race_datetime: 4.weeks.from_now, experience_labels: ["Rookie", "Veteran"]) }
  let!(:requirement) { FactoryBot.create(:payment_requirement_with_tier, race: race) }
  let!(:future_tier) { FactoryBot.create(:tier3, requirement: requirement) }

  describe "GET /api/v1/races" do
    it "lists current races ordered by race datetime, without logging in" do
      later = FactoryBot.create(:race, race_datetime: 8.weeks.from_now)
      FactoryBot.create(:race, race_datetime: 1.week.ago, registration_open: 6.weeks.ago, registration_close: 3.weeks.ago,
                    final_edits_close: 2.weeks.ago)

      get "/api/v1/races"

      expect(response).to have_http_status(:ok)
      expect(json["races"].map { |r| r["id"] }).to eq([race.id, later.id])
    end
  end

  it "lists a current race that has both plain and payment requirements" do
    FactoryBot.create(:requirement, race: race)

    get "/api/v1/races"

    expect(response).to have_http_status(:ok)
    payment_requirements = json["races"].first["payment_requirements"]
    expect(payment_requirements.map { |r| r["id"] }).to eq([requirement.id])
  end

  describe "GET /api/v1/races/:id" do
    it "returns the race fields" do
      get "/api/v1/races/#{race.id}"

      expect(response).to have_http_status(:ok)
      body = json["race"]
      expect(body).to include(
        "id" => race.id,
        "name" => race.name,
        "open_for_registration" => true,
        "full" => false,
        "people_per_team" => race.people_per_team,
        "experience_labels" => ["Rookie", "Veteran"],
        "stripe_publishable_key" => Rails.configuration.stripe[:publishable_key]
      )
      %w[race_datetime registration_open registration_close final_edits_close].each do |field|
        expect(Time.iso8601(body[field])).to be_within(1.second).of(race.public_send(field))
      end
      expect(body["jsonform"]).to eq(JSON.parse(race.jsonform))
    end

    it "lists payment requirements with the current price and next tier" do
      get "/api/v1/races/#{race.id}"

      expect(json["race"]["payment_requirements"]).to eq([
        {
          "id" => requirement.id,
          "name" => requirement.name,
          "type" => "PaymentRequirement",
          "current_price_cents" => 5000,
          "next_tier" => { "price_cents" => 7000, "begins_at" => future_tier.begin_at.iso8601(3) }
        }
      ])
    end

    it "has a null next tier when none remain and omits non-payment requirements" do
      future_tier.destroy
      FactoryBot.create(:requirement, race: race)

      get "/api/v1/races/#{race.id}"

      payment_requirements = json["race"]["payment_requirements"]
      expect(payment_requirements.size).to eq(1)
      expect(payment_requirements.first["next_tier"]).to be_nil
    end

    it "returns a null jsonform when the race has none or it is invalid" do
      race.update_columns(jsonform: nil)
      get "/api/v1/races/#{race.id}"
      expect(json["race"]["jsonform"]).to be_nil

      race.update_columns(jsonform: "{not json")
      get "/api/v1/races/#{race.id}"
      expect(response).to have_http_status(:ok)
      expect(json["race"]["jsonform"]).to be_nil
    end

    it "returns the 404 envelope for a missing race" do
      get "/api/v1/races/0"

      expect(response).to have_http_status(:not_found)
      expect(json).to eq("error" => "not_found", "errors" => {})
    end
  end
end
