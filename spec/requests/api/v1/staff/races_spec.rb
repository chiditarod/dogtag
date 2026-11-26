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

  describe "writing" do
    let(:chicago) { ActiveSupport::TimeZone["America/Chicago"] }
    let(:dates) do
      { registration_open: "2026-12-07T12:00", registration_close: "2027-02-01T23:59",
        final_edits_close: "2027-03-01T23:59", race_datetime: "2027-03-13T11:00" }
    end
    let(:attrs) { { name: "Race 2027", time_zone: "America/Chicago", max_teams: 100, people_per_team: 5 }.merge(dates) }

    describe "POST /api/v1/staff/races" do
      before { api_login(FactoryBot.create(:operator_user)) }

      it "creates a race, reading wall-clock dates in the race's zone, and returns the staff race" do
        expect { post "/api/v1/staff/races", params: { race: attrs.merge(filter_field: ["racer-type", ""]) } }
          .to change(Race, :count).by(1)

        expect(response).to have_http_status(:created)
        race = Race.find(json["race"]["id"])
        expect(race.registration_open).to eq(chicago.parse("2026-12-07 12:00"))
        expect(race.race_datetime).to eq(chicago.parse("2027-03-13 11:00"))
        expect(race.filter_field).to eq("racer-type")
        expect(json["race"]).to include("name" => "Race 2027", "can_destroy" => false, "has_teams" => false,
          "filter_field" => ["racer-type"])
      end

      it "reads the dates in a submitted zone" do
        post "/api/v1/staff/races", params: { race: attrs.merge(time_zone: "America/New_York") }

        expect(Race.find(json["race"]["id"]).registration_open).to eq(ActiveSupport::TimeZone["America/New_York"].parse("2026-12-07 12:00"))
      end

      it "refuses out-of-order dates with field errors" do
        post "/api/v1/staff/races", params: { race: attrs.merge(final_edits_close: "2027-03-20T12:00") }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["final_edits_close"]).to eq(["must be before Race day"])
        expect(Race.where(name: "Race 2027")).not_to exist
      end

      it "refuses a time in a clock-change gap" do
        expect { post "/api/v1/staff/races", params: { race: attrs.merge(race_datetime: "2027-03-14T02:30") } }
          .not_to change(Race, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["race_datetime"].join).to include("doesn't exist")
      end

      it "reports missing required fields by field" do
        post "/api/v1/staff/races", params: { race: { time_zone: "America/Chicago" } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"].keys).to include("name", "max_teams", "people_per_team", "race_datetime")
      end

      it "is 400 without a race key" do
        post "/api/v1/staff/races", params: { name: "x" }

        expect(response).to have_http_status(:bad_request)
      end

      it "ignores unknown keys" do
        post "/api/v1/staff/races", params: { race: attrs.merge(id: 999_999, finalized_teams_count: 9) }

        expect(response).to have_http_status(:created)
        expect(json["race"]["id"]).not_to eq(999_999)
      end
    end

    describe "PATCH /api/v1/staff/races/:id" do
      let!(:race) do
        FactoryBot.create(:race, time_zone: "America/Chicago", filter_field: "a,b").tap do |r|
          r.update_columns(registration_open: chicago.parse("2026-12-07 12:00:17"),
            registration_close: chicago.parse("2027-02-01 23:59"), final_edits_close: chicago.parse("2027-03-01 23:59"),
            race_datetime: chicago.parse("2027-03-13 11:00"))
        end
      end

      before { api_login(FactoryBot.create(:operator_user)) }

      it "changes only the sent fields and keeps stored seconds on dates that were not sent" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { name: "Renamed" } }

        expect(response).to have_http_status(:ok)
        expect(json["race"]["name"]).to eq("Renamed")
        expect(race.reload.registration_open.to_f).to eq(chicago.parse("2026-12-07 12:00:17").to_f)
      end

      it "reads a sent date in the stored zone" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { registration_open: "2026-12-08T09:30" } }

        expect(race.reload.registration_open).to eq(chicago.parse("2026-12-08 09:30"))
        expect(race.time_zone).to eq("America/Chicago")
      end

      it "re-reads every date in the new zone when the zone changes" do
        new_york = ActiveSupport::TimeZone["America/New_York"]
        patch "/api/v1/staff/races/#{race.id}", params: { race: { time_zone: "America/New_York",
          registration_open: "2026-12-07T12:00", registration_close: "2027-02-01T23:59",
          final_edits_close: "2027-03-01T23:59", race_datetime: "2027-03-13T11:00" } }

        expect(response).to have_http_status(:ok)
        race.reload
        expect(race.time_zone).to eq("America/New_York")
        expect(race.registration_open).to eq(new_york.parse("2026-12-07 12:00"))
        expect(race.registration_close).to eq(new_york.parse("2027-02-01 23:59"))
        expect(race.final_edits_close).to eq(new_york.parse("2027-03-01 23:59"))
        expect(race.race_datetime).to eq(new_york.parse("2027-03-13 11:00"))
      end

      it "refuses a zone change that does not send every date" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { time_zone: "America/New_York", registration_open: "2026-12-07T12:00" } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["time_zone"]).to eq(["send every date when you change the time zone"])
        race.reload
        expect(race.time_zone).to eq("America/Chicago")
        expect(race.registration_open.to_f).to eq(chicago.parse("2026-12-07 12:00:17").to_f)
      end

      it "accepts the stored zone sent again with one date" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { time_zone: "America/Chicago", name: "Same zone" } }

        expect(response).to have_http_status(:ok)
      end

      it "joins filter_field and clears it with an empty array" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { filter_field: ["racer-type", ""] } }
        expect(race.reload.filter_field).to eq("racer-type")

        patch "/api/v1/staff/races/#{race.id}", params: { race: { filter_field: [""] } }
        expect(race.reload.filter_field).to be_blank
      end

      it "returns field errors and saves nothing for an invalid date" do
        patch "/api/v1/staff/races/#{race.id}", params: { race: { name: "Nope", registration_open: "2026-13-40T12:00" } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["registration_open"]).to eq(["must be a date and time"])
        expect(race.reload.name).not_to eq("Nope")
      end

      it "is 404 for an unknown id" do
        patch "/api/v1/staff/races/0", params: { race: { name: "x" } }

        expect(response).to have_http_status(:not_found)
      end
    end

    describe "refunders" do
      let!(:race) { FactoryBot.create(:race) }

      before { api_login(FactoryBot.create(:refunder_user)) }

      it "get 403 on create, update and delete" do
        post "/api/v1/staff/races", params: { race: attrs }
        expect(response).to have_http_status(:forbidden)
        patch "/api/v1/staff/races/#{race.id}", params: { race: { name: "x" } }
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/staff/races/#{race.id}"
        expect(response).to have_http_status(:forbidden)
        expect(Race.find(race.id).name).to eq(race.name)
      end
    end

    describe "DELETE /api/v1/staff/races/:id" do
      let!(:race) { FactoryBot.create(:race) }

      it "is 403 for an operator" do
        api_login(FactoryBot.create(:operator_user))
        delete "/api/v1/staff/races/#{race.id}"

        expect(response).to have_http_status(:forbidden)
        expect(Race.exists?(race.id)).to be(true)
      end

      context "as an admin" do
        before { api_login(FactoryBot.create(:admin_user)) }

        it "refuses a race with any team" do
          FactoryBot.create(:team, race:)
          delete "/api/v1/staff/races/#{race.id}"

          expect(response).to have_http_status(:unprocessable_entity)
          expect(json["code"]).to eq("race_has_teams")
          expect(Race.exists?(race.id)).to be(true)
        end

        it "deletes an empty race with its requirements and tiers" do
          fee = FactoryBot.create(:payment_requirement_with_tier, race:)
          tier_ids = fee.tiers.pluck(:id)
          expect(tier_ids).not_to be_empty
          delete "/api/v1/staff/races/#{race.id}"

          expect(response).to have_http_status(:no_content)
          expect(Race.exists?(race.id)).to be(false)
          expect(Requirement.exists?(fee.id)).to be(false)
          expect(Tier.where(id: tier_ids)).not_to exist
        end
      end
    end
  end
end

describe "API v1 staff race export", type: :request do
  let(:race) { FactoryBot.create(:race) }

  before do
    FactoryBot.create(:finalized_team, race:)
    FactoryBot.create(:team, race:)
  end

  it "is 401 when logged out" do
    get "/api/v1/staff/races/#{race.id}/export.csv"
    expect(response).to have_http_status(:unauthorized)
  end

  %i[user refunder_user].each do |factory|
    it "is 403 JSON for #{factory}" do
      api_login(FactoryBot.create(factory))
      get "/api/v1/staff/races/#{race.id}/export.csv"
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to be_present
    end
  end

  %i[operator_user admin_user].each do |factory|
    context "as #{factory}" do
      before { api_login(FactoryBot.create(factory)) }

      it "downloads every team as CSV" do
        get "/api/v1/staff/races/#{race.id}/export.csv"
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to start_with("text/csv")
        expect(response.headers["Content-Disposition"]).to include("race_#{race.id}_export.csv")
        expect(CSV.parse(response.body).size).to eq(3)
      end

      it "limits to finalized teams only for finalized=true" do
        get "/api/v1/staff/races/#{race.id}/export.csv", params: { finalized: "true" }
        expect(CSV.parse(response.body).size).to eq(2)

        get "/api/v1/staff/races/#{race.id}/export.csv", params: { finalized: "1" }
        expect(CSV.parse(response.body).size).to eq(3)
      end

      it "is 404 JSON for an unknown race" do
        get "/api/v1/staff/races/0/export.csv"
        expect(response).to have_http_status(:not_found)
        expect(json["error"]).to eq("not_found")
      end
    end
  end
end
