require "spec_helper"

describe "API v1 past racers", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:team) { FactoryBot.create(:team, user: user) }

  describe "GET /api/v1/teams/:team_id/past_racers" do
    it "returns 401 when logged out" do
      get "/api/v1/teams/#{team.id}/past_racers"
      expect(response).to have_http_status(:unauthorized)
      expect(json["error"]).to eq("not_authenticated")
    end

    context "when logged in" do
      before { api_login(user) }

      it "returns past racers with last team and race details, without ids" do
        race = FactoryBot.create(:race, name: "CHIditarod 2024")
        old_team = FactoryBot.create(:team, user: user, race: race, name: "Cart Wheelers")
        racer = FactoryBot.create(:person, team: old_team, twitter: "@racer")
        # Person validations lock edits after a race, so move it into the past afterwards.
        race.update_columns(race_datetime: Time.zone.local(2024, 3, 2))

        get "/api/v1/teams/#{team.id}/past_racers"

        expect(response).to have_http_status(:ok)
        expect(json["past_racers"].size).to eq(1)
        expect(json["past_racers"].first).to eq(
          "first_name" => racer.first_name, "last_name" => racer.last_name, "email" => racer.email,
          "phone" => racer.phone, "zipcode" => racer.zipcode, "experience" => racer.experience,
          "twitter" => "@racer", "last_team_name" => "Cart Wheelers",
          "last_race_name" => "CHIditarod 2024", "last_raced_year" => 2024
        )
      end

      it "returns an empty list for a user with no history" do
        get "/api/v1/teams/#{team.id}/past_racers"
        expect(response).to have_http_status(:ok)
        expect(json["past_racers"]).to eq([])
      end

      it "never includes another user's racers" do
        FactoryBot.create(:person, team: FactoryBot.create(:team))
        get "/api/v1/teams/#{team.id}/past_racers"
        expect(json["past_racers"]).to eq([])
      end

      it "returns 403 for another user's team" do
        other = FactoryBot.create(:team)
        get "/api/v1/teams/#{other.id}/past_racers"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
