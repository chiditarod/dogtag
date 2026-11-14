require "spec_helper"

describe "API v1 people", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race) }
  let!(:team) { FactoryBot.create(:team, user: user, race: race) }
  let(:person_params) do
    { first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", phone: "(312) 555-0144",
      zipcode: "60614", experience: 1, twitter: "@ada" }
  end

  before { api_login(user) }

  describe "POST /api/v1/teams/:team_id/people" do
    it "creates a person with a normalized phone and returns the checklist" do
      expect do
        post "/api/v1/teams/#{team.id}/people", params: { person: person_params }, as: :json
      end.to change { team.people.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json["person"]).to include("first_name" => "Ada", "phone" => "312-555-0144", "twitter" => "@ada")
      expect(json["person"].keys).to match_array(%w[id first_name last_name email phone zipcode experience twitter])
      expect(json["checklist"]["racers"]).to include("filled" => 1, "total" => 2)
    end

    it "returns 422 with field errors when invalid" do
      post "/api/v1/teams/#{team.id}/people", params: { person: person_params.merge(phone: "555-0144") }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["phone"]).to be_present
    end

    it "returns 400 when the person param is missing" do
      post "/api/v1/teams/#{team.id}/people", params: {}, as: :json
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 422 with a maximum error beyond people_per_team" do
      FactoryBot.create_list(:person, race.people_per_team, team: team)
      post "/api/v1/teams/#{team.id}/people", params: { person: person_params }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["maximum"]).to be_present
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      expect do
        post "/api/v1/teams/#{other.id}/people", params: { person: person_params }, as: :json
      end.not_to change(Person, :count)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 404 for a missing team" do
      post "/api/v1/teams/0/people", params: { person: person_params }, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "returns 403 with a readable error once registration has closed" do
      closed_team = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race, :registration_closed))
      expect do
        post "/api/v1/teams/#{closed_team.id}/people", params: { person: person_params }, as: :json
      end.not_to change(Person, :count)
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to eq("Registration is closed for this race.")
    end

    it "does not tell a refunder that registration is closed while it is open" do
      api_login(FactoryBot.create(:refunder_user))
      expect do
        post "/api/v1/teams/#{team.id}/people", params: { person: person_params }, as: :json
      end.not_to change(Person, :count)
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).not_to eq(I18n.t("api.errors.registration_closed"))
    end

    it "returns 403 after the final edit date" do
      late_team = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race, :after_final_edits_window))
      post "/api/v1/teams/#{late_team.id}/people", params: { person: person_params }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "finalizes a complete team when the last slot is filled" do
      FactoryBot.create(:person, team: team)
      Workers::TeamFinalizer.jobs.clear

      post "/api/v1/teams/#{team.id}/people", params: { person: person_params }, as: :json

      expect(response).to have_http_status(:created)
      expect(json["checklist"]["finalized"]).to be(true)
      expect(team.reload.finalized).to be(true)
      expect(Workers::TeamFinalizer.jobs.size).to eq(1)
    end
  end

  describe "PATCH /api/v1/teams/:team_id/people/:id" do
    let!(:person) { FactoryBot.create(:person, team: team) }

    it "updates the person" do
      patch "/api/v1/teams/#{team.id}/people/#{person.id}", params: { person: { first_name: "Grace" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json["person"]["first_name"]).to eq("Grace")
      expect(json["checklist"]).to include("remaining")
      expect(person.reload.first_name).to eq("Grace")
    end

    it "returns 422 when invalid" do
      patch "/api/v1/teams/#{team.id}/people/#{person.id}", params: { person: { zipcode: "x" } }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["zipcode"]).to be_present
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      other_person = FactoryBot.create(:person, team: other)
      patch "/api/v1/teams/#{other.id}/people/#{other_person.id}", params: { person: { first_name: "Hax" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(other_person.reload.first_name).not_to eq("Hax")
    end

    it "does not allow addressing a person through a different team" do
      other = FactoryBot.create(:team, user: user, race: race)
      patch "/api/v1/teams/#{other.id}/people/#{person.id}", params: { person: { first_name: "Hax" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "still allows updating during the final edits window" do
      window_team = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race, :in_final_edits_window))
      window_person = FactoryBot.build(:person, team: window_team).tap { |p| p.save!(validate: false) }
      patch "/api/v1/teams/#{window_team.id}/people/#{window_person.id}", params: { person: { first_name: "Edited" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(window_person.reload.first_name).to eq("Edited")
    end

    it "returns 403 with a readable message after the final edit date" do
      late_race = FactoryBot.create(:race, :after_final_edits_window)
      late_team = FactoryBot.create(:team, user: user, race: late_race)
      late_person = FactoryBot.build(:person, team: late_team).tap { |p| p.save!(validate: false) }
      patch "/api/v1/teams/#{late_team.id}/people/#{late_person.id}", params: { person: { first_name: "Late" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to eq("Registration is closed for this race.")
    end
  end

  describe "DELETE /api/v1/teams/:team_id/people/:id" do
    let!(:person) { FactoryBot.create(:person, team: team) }

    it "removes the person and returns the checklist" do
      expect do
        delete "/api/v1/teams/#{team.id}/people/#{person.id}", as: :json
      end.to change { team.people.count }.by(-1)

      expect(response).to have_http_status(:ok)
      expect(json["checklist"]["racers"]).to include("filled" => 0)
    end

    it "returns 422 when the team is complete" do
      FactoryBot.create(:person, team: team)
      team.reload.finalize
      expect(team.reload.finalized).to be(true)

      expect do
        delete "/api/v1/teams/#{team.id}/people/#{person.id}", as: :json
      end.not_to change(Person, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq(I18n.t("people.destroy.team_complete"))
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      other_person = FactoryBot.create(:person, team: other)
      expect do
        delete "/api/v1/teams/#{other.id}/people/#{other_person.id}", as: :json
      end.not_to change(Person, :count)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 403 when registration is closed" do
      closed_team = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race, :registration_closed))
      closed_person = FactoryBot.build(:person, team: closed_team).tap { |p| p.save!(validate: false) }
      delete "/api/v1/teams/#{closed_team.id}/people/#{closed_person.id}", as: :json
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to eq("Registration is closed for this race.")
    end
  end
end
