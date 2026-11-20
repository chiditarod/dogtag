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

    describe "ordering by registration status" do
      # Race dates run opposite to the expected order, so date order alone cannot pass.
      let!(:waitlist) { FactoryBot.create(:full_race, race_datetime: 3.5.weeks.from_now) }
      let!(:closed) do
        FactoryBot.create(:race, registration_open: 3.weeks.ago, registration_close: 1.week.ago,
                                 final_edits_close: 1.week.from_now, race_datetime: 2.weeks.from_now)
      end
      let!(:not_yet_open) do
        FactoryBot.create(:race, registration_open: 2.days.from_now, registration_close: 1.week.from_now,
                                 final_edits_close: 10.days.from_now, race_datetime: 11.days.from_now)
      end

      it "lists open races, then waitlist, then registration-over, then not-yet-open races" do
        get "/api/v1/races"

        expect(json["races"].map { |r| r["id"] }).to eq([race.id, waitlist.id, closed.id, not_yet_open.id])
        expect(json["races"].map { |r| r["registration_status"] }).to eq(%w[open waitlist closed not_yet_open])
      end

      it "orders not-yet-open races by when registration opens, not by race date" do
        opens_first_races_later = FactoryBot.create(:race, registration_open: 1.day.from_now,
                                                           registration_close: 2.weeks.from_now,
                                                           final_edits_close: 3.weeks.from_now,
                                                           race_datetime: 10.weeks.from_now)

        get "/api/v1/races"

        ids = json["races"].map { |r| r["id"] }
        expect(ids.last(2)).to eq([opens_first_races_later.id, not_yet_open.id])
      end

      it "breaks ties on race datetime by id" do
        tied = FactoryBot.create(:race, race_datetime: race.race_datetime)

        get "/api/v1/races"

        ids = json["races"].map { |r| r["id"] }
        expect(ids.first(2)).to eq([race.id, tied.id])
      end
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
        "registration_status" => "open",
        "people_per_team" => race.people_per_team,
        "experience_labels" => ["Rookie", "Veteran"],
        "stripe_publishable_key" => Rails.configuration.stripe[:publishable_key],
        "time_zone" => "America/Chicago"
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
