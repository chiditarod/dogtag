require "spec_helper"

describe "API v1 questions", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race_with_jsonform) }
  let!(:team) { FactoryBot.create(:team, user: user, race: race) }
  let(:valid_answers) { JSON.parse(File.read(Rails.root.join("spec/fixtures/files/valid_team_jsonform.json"))) }
  let(:path) { "/api/v1/teams/#{team.id}/questions" }

  let(:login_user) { user }

  before { api_login(login_user) if login_user }

  describe "GET /api/v1/teams/:team_id/questions" do
    it "returns the parsed race jsonform and the saved answers" do
      team.update_column(:jsonform, valid_answers.to_json)
      get path
      expect(response).to have_http_status(:ok)
      expect(json["jsonform"].keys).to match_array(%w[schema form])
      expect(json["answers"]).to eq(valid_answers)
    end

    it "returns empty answers when none are saved" do
      get path
      expect(json["answers"]).to eq({})
    end

    it "returns a null jsonform for a race without questions" do
      plain = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race))
      get "/api/v1/teams/#{plain.id}/questions"
      expect(response).to have_http_status(:ok)
      expect(json).to eq("jsonform" => nil, "answers" => {})
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      get "/api/v1/teams/#{other.id}/questions"
      expect(response).to have_http_status(:forbidden)
    end

    context "when logged out" do
      let(:login_user) { nil }

      it "returns 401" do
        get path
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "PUT /api/v1/teams/:team_id/questions" do
    it "saves valid answers and returns the checklist" do
      put path, params: { answers: valid_answers }, as: :json
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(team.reload.jsonform)).to eq(valid_answers)
      expect(json["answers"]).to eq(valid_answers)
      expect(json["checklist"]).to be_a(Hash)
    end

    it "drops unknown keys" do
      put path, params: { answers: valid_answers.merge("hacker" => "yes") }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json["answers"]).not_to have_key("hacker")
      expect(JSON.parse(team.reload.jsonform)).not_to have_key("hacker")
    end

    it "returns 422 for an invalid enum value without saving" do
      put path, params: { answers: valid_answers.merge("racer-type" => "Spaceship") }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq("invalid_answers")
      expect(json["errors"]["questions"]).to be_present
      expect(team.reload.jsonform).to be_nil
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      put "/api/v1/teams/#{other.id}/questions", params: { answers: valid_answers }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(other.reload.jsonform).to be_nil
    end

    it "returns 403 with a readable error once registration has closed" do
      closed_race = FactoryBot.create(:race_with_jsonform, :registration_closed)
      closed_team = FactoryBot.create(:team, user: user, race: closed_race)
      put "/api/v1/teams/#{closed_team.id}/questions", params: { answers: valid_answers }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to eq(I18n.t("api.errors.registration_closed"))
      expect(closed_team.reload.jsonform).to be_nil
    end

    context "as a refunder" do
      let(:login_user) { FactoryBot.create(:refunder_user) }

      it "returns 403" do
        put path, params: { answers: valid_answers }, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when logged out" do
      let(:login_user) { nil }

      it "returns 401" do
        put path, params: { answers: valid_answers }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "returns 422 no_questions for a race without a jsonform" do
      plain = FactoryBot.create(:team, user: user, race: FactoryBot.create(:race))
      put "/api/v1/teams/#{plain.id}/questions", params: { answers: { "a" => "b" } }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq("no_questions")
    end
  end
end
