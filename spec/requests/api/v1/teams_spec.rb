require "spec_helper"

describe "API v1 teams", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race_with_jsonform) }
  let(:team_params) { { name: "Cart Wheelers", description: "We roll", experience: 2 } }

  context "when logged out" do
    it "returns 401" do
      get "/api/v1/teams"
      expect(response).to have_http_status(:unauthorized)
      expect(json["error"]).to eq("not_authenticated")
    end
  end

  context "when logged in" do
    before { api_login(user) }

    describe "GET /api/v1/teams" do
      it "lists only my teams, newest first, with race name and remaining" do
        older = FactoryBot.create(:team, user: user, race: race, created_at: 2.days.ago)
        newer = FactoryBot.create(:team, user: user, race: race, created_at: 1.day.ago)
        FactoryBot.create(:team, race: race)

        get "/api/v1/teams"

        expect(response).to have_http_status(:ok)
        expect(json["teams"].map { |t| t["id"] }).to eq([newer.id, older.id])
        expect(json["teams"].first["race"]["name"]).to eq(race.name)
        expect(json["teams"].first["checklist"]).to include("remaining")
      end
    end

    describe "POST /api/v1/teams" do
      it "creates a team for the current user and returns the full team" do
        expect do
          post "/api/v1/teams", params: { race_id: race.id, team: team_params }, as: :json
        end.to change(Team, :count).by(1)

        expect(response).to have_http_status(:created)
        team = Team.last
        expect(team.user).to eq(user)
        expect(team.race).to eq(race)
        expect(json["team"]).to include("id" => team.id, "name" => "Cart Wheelers", "description" => "We roll", "experience" => 2)
        expect(json["team"]["race"]["id"]).to eq(race.id)
        expect(json["team"]["people"]).to eq([])
        expect(json["team"]["checklist"]["racers"]).to include("filled" => 0, "total" => race.people_per_team)
      end

      it "returns 403 and creates nothing when registration is closed" do
        closed = FactoryBot.create(:race, :registration_closed)
        expect do
          post "/api/v1/teams", params: { race_id: closed.id, team: team_params }, as: :json
        end.not_to change(Team, :count)
        expect(response).to have_http_status(:forbidden)
        expect(json["error"]).to eq("Registration is closed for this race.")
      end

      it "returns 403 when registration has not opened yet" do
        upcoming = FactoryBot.create(:race, :registration_opens_tomorrow)
        post "/api/v1/teams", params: { race_id: upcoming.id, team: team_params }, as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it "allows joining a full race that is open (waitlist)" do
        full = FactoryBot.create(:full_race)
        post "/api/v1/teams", params: { race_id: full.id, team: team_params }, as: :json
        expect(response).to have_http_status(:created)
      end

      it "lets an operator create a team on a closed race" do
        operator = FactoryBot.create(:operator_user)
        api_login(operator)
        closed = FactoryBot.create(:race, :registration_closed)
        post "/api/v1/teams", params: { race_id: closed.id, team: team_params }, as: :json
        expect(response).to have_http_status(:created)
        expect(Team.last.user).to eq(operator)
      end

      it "returns 404 when the race does not exist" do
        post "/api/v1/teams", params: { race_id: 0, team: team_params }, as: :json
        expect(response).to have_http_status(:not_found)
      end

      it "returns 422 with field errors when invalid" do
        post "/api/v1/teams", params: { race_id: race.id, team: team_params.merge(name: "") }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["name"]).to be_present
      end

      it "returns 400 when the team param is missing" do
        post "/api/v1/teams", params: { race_id: race.id }, as: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "ignores a user_id param" do
        other = FactoryBot.create(:user)
        post "/api/v1/teams", params: { race_id: race.id, team: team_params.merge(user_id: other.id) }, as: :json
        expect(Team.last.user).to eq(user)
      end
    end

    describe "GET /api/v1/teams/:id" do
      let!(:team) { FactoryBot.create(:team, :with_people, user: user, race: race) }

      it "returns the team with race, people and checklist" do
        get "/api/v1/teams/#{team.id}"

        expect(response).to have_http_status(:ok)
        expect(json["team"]["id"]).to eq(team.id)
        expect(json["team"]["race"]["name"]).to eq(race.name)
        expect(json["team"]["people"].size).to eq(team.people.size)
        expect(json["team"]["people"].first.keys).to match_array(%w[id first_name last_name email phone zipcode experience twitter])
        expect(json["team"]["checklist"]["racers"]).to include("filled" => 1, "total" => 2, "done" => false)
      end

      it "returns 403 for another user's team" do
        other = FactoryBot.create(:team, race: race)
        get "/api/v1/teams/#{other.id}"
        expect(response).to have_http_status(:forbidden)
        expect(json["error"]).to be_present
      end

      it "returns 404 for a missing team" do
        get "/api/v1/teams/0"
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "PATCH /api/v1/teams/:id" do
      let!(:team) { FactoryBot.create(:team, user: user, race: race) }

      it "updates the team" do
        patch "/api/v1/teams/#{team.id}", params: { team: { name: "Renamed" } }, as: :json

        expect(response).to have_http_status(:ok)
        expect(json["team"]["name"]).to eq("Renamed")
        expect(team.reload.name).to eq("Renamed")
      end

      it "returns 422 when invalid" do
        patch "/api/v1/teams/#{team.id}", params: { team: { name: "" } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["name"]).to be_present
      end

      it "returns 403 for another user's team" do
        other = FactoryBot.create(:team, race: race)
        patch "/api/v1/teams/#{other.id}", params: { team: { name: "Hax" } }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(other.reload.name).not_to eq("Hax")
      end

      it "returns 403 with a readable message when registration is closed" do
        closed = FactoryBot.create(:race, :registration_closed)
        closed_team = FactoryBot.create(:team, user: user, race: closed)
        patch "/api/v1/teams/#{closed_team.id}", params: { team: { name: "Late" } }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json["error"]).to eq("Registration is closed for this race.")
      end

      it "does not tell a refunder that registration is closed while it is open" do
        api_login(FactoryBot.create(:refunder_user))
        patch "/api/v1/teams/#{team.id}", params: { team: { name: "Hax" } }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json["error"]).not_to eq(I18n.t("api.errors.registration_closed"))
        expect(team.reload.name).not_to eq("Hax")
      end
    end
  end
end
