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
      expect(json).to eq("jsonform" => nil, "answers" => {}, "buddy_team_ids" => [], "other_buddies" => nil)
    end

    it "returns picked team ids and other_buddies" do
      b = FactoryBot.create(:team, race: race)
      a = FactoryBot.create(:team, race: race)
      FactoryBot.create(:team_buddy, team: team, buddy_team: b)
      FactoryBot.create(:team_buddy, team: team, buddy_team: a)
      team.update_column(:other_buddies, "The Rolling Pins")
      get path
      expect(response).to have_http_status(:ok)
      expect(json["buddy_team_ids"]).to eq([a.id, b.id].sort)
      expect(json["other_buddies"]).to eq("The Rolling Pins")
    end

    it "returns no picks and a null other_buddies by default" do
      get path
      expect(json["buddy_team_ids"]).to eq([])
      expect(json["other_buddies"]).to be_nil
    end

    it "omits a picked team after it is deleted and still returns 200" do
      gone = FactoryBot.create(:team, race: race)
      kept = FactoryBot.create(:team, race: race)
      FactoryBot.create(:team_buddy, team: team, buddy_team: gone)
      FactoryBot.create(:team_buddy, team: team, buddy_team: kept)
      gone.destroy
      get path
      expect(response).to have_http_status(:ok)
      expect(json["buddy_team_ids"]).to eq([kept.id])
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

    describe "team picks" do
      let!(:friend) { FactoryBot.create(:team, race: race) }
      let!(:rival) { FactoryBot.create(:team, race: race) }

      def put_picks(body)
        put path, params: body, as: :json
      end

      it "saves picks and other_buddies with the answers" do
        put_picks(answers: valid_answers, buddy_team_ids: [friend.id, rival.id], other_buddies: "  The Rolling Pins ")
        expect(response).to have_http_status(:ok)
        expect(team.team_buddies.pluck(:buddy_team_id)).to match_array([friend.id, rival.id])
        expect(team.reload.other_buddies).to eq("The Rolling Pins")
        expect(JSON.parse(team.jsonform)).to eq(valid_answers)
        expect(json["buddy_team_ids"]).to eq([friend.id, rival.id].sort)
        expect(json["other_buddies"]).to eq("The Rolling Pins")
        expect(json["answers"]).to eq(valid_answers)
        expect(json["checklist"]).to be_a(Hash)
      end

      it "replaces the previous picks" do
        FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
        put_picks(buddy_team_ids: [rival.id])
        expect(response).to have_http_status(:ok)
        expect(team.team_buddies.pluck(:buddy_team_id)).to eq([rival.id])
        expect(json["buddy_team_ids"]).to eq([rival.id])
      end

      it "clears the picks with an empty buddy_team_ids" do
        FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
        put_picks(buddy_team_ids: [])
        expect(response).to have_http_status(:ok)
        expect(team.team_buddies.count).to eq(0)
        expect(json["buddy_team_ids"]).to eq([])
      end

      it "leaves picks and other_buddies unchanged without buddy keys" do
        FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
        team.update_column(:other_buddies, "Kept")
        put_picks(answers: valid_answers)
        expect(response).to have_http_status(:ok)
        expect(team.team_buddies.pluck(:buddy_team_id)).to eq([friend.id])
        expect(team.reload.other_buddies).to eq("Kept")
        expect(json["buddy_team_ids"]).to eq([friend.id])
        expect(json["other_buddies"]).to eq("Kept")
      end

      it "dedupes repeated ids" do
        put_picks(buddy_team_ids: [friend.id, friend.id])
        expect(response).to have_http_status(:ok)
        expect(team.team_buddies.count).to eq(1)
        expect(json["buddy_team_ids"]).to eq([friend.id])
      end

      it "stores blank other_buddies as nil" do
        team.update_column(:other_buddies, "Old")
        put_picks(other_buddies: "   ")
        expect(response).to have_http_status(:ok)
        expect(team.reload.other_buddies).to be_nil
        expect(json["other_buddies"]).to be_nil
      end

      shared_examples "an invalid pick" do
        it "returns 422 invalid_buddies and saves nothing" do
          FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
          expect {
            put_picks(answers: valid_answers, buddy_team_ids: [bad_id.call, rival.id], other_buddies: "New")
          }.not_to change(TeamBuddy, :count)
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json["error"]).to eq("invalid_buddies")
          expect(json["errors"]["buddy_team_ids"]).to be_present
          expect(team.reload.jsonform).to be_nil
          expect(team.other_buddies).to be_nil
          expect(team.team_buddies.pluck(:buddy_team_id)).to eq([friend.id])
        end
      end

      context "with a team from another race" do
        let(:bad_id) { -> { FactoryBot.create(:team, race: FactoryBot.create(:race)).id } }
        it_behaves_like "an invalid pick"
      end

      context "with the team's own id" do
        let(:bad_id) { -> { team.id } }
        it_behaves_like "an invalid pick"
      end

      context "with an unknown id" do
        let(:bad_id) { -> { Team.maximum(:id) + 1000 } }
        it_behaves_like "an invalid pick"
      end

      %w[0x1A 1_0 0b1 1.5].each do |malformed|
        it "returns 422 invalid_buddies for the non-decimal id #{malformed.inspect} and saves nothing" do
          FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
          expect {
            put_picks(answers: valid_answers, buddy_team_ids: [malformed])
          }.not_to change(TeamBuddy, :count)
          expect(response).to have_http_status(:unprocessable_entity)
          expect(json["error"]).to eq("invalid_buddies")
          expect(team.reload.jsonform).to be_nil
          expect(team.team_buddies.pluck(:buddy_team_id)).to eq([friend.id])
        end
      end

      it "returns 400 when buddy_team_ids is not an array" do
        expect { put_picks(buddy_team_ids: friend.id.to_s) }.not_to change(TeamBuddy, :count)
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects other_buddies over 1000 characters without saving anything" do
        FactoryBot.create(:team_buddy, team: team, buddy_team: friend)
        put_picks(answers: valid_answers, buddy_team_ids: [rival.id], other_buddies: "a" * 1001)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["error"]).to eq("invalid_buddies")
        expect(json["errors"]["other_buddies"]).to be_present
        expect(team.reload.jsonform).to be_nil
        expect(team.other_buddies).to be_nil
        expect(team.team_buddies.pluck(:buddy_team_id)).to eq([friend.id])
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
