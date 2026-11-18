require "spec_helper"

describe "API v1 buddy options", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race) }
  let!(:team) { FactoryBot.create(:team, user: user, race: race) }
  let(:path) { "/api/v1/teams/#{team.id}/buddy_options" }

  let(:login_user) { user }

  before { api_login(login_user) if login_user }

  describe "GET /api/v1/teams/:team_id/buddy_options" do
    it "lists the other teams in the race alphabetically with finalized flags" do
      FactoryBot.create(:team, race: race, name: "banana")
      FactoryBot.create(:team, race: race, name: "Apple", finalized: true)
      FactoryBot.create(:team, race: race, name: "cherry")

      get path
      expect(response).to have_http_status(:ok)
      expect(json["teams"].map { |t| t["name"] }).to eq(%w[Apple banana cherry])
      expect(json["teams"].map { |t| t.keys.sort }.uniq).to eq([%w[finalized id name]])
      expect(json["teams"].map { |t| t["finalized"] }).to eq([true, false, false])
      expect(json["teams"].map { |t| t["id"] }).not_to include(team.id)
    end

    it "leaves out teams from other races" do
      FactoryBot.create(:team, race: FactoryBot.create(:race), name: "Elsewhere")
      mine = FactoryBot.create(:team, race: race, name: "Here")

      get path
      expect(json["teams"].map { |t| t["id"] }).to eq([mine.id])
    end

    it "returns an empty list when the race has no other teams" do
      get path
      expect(response).to have_http_status(:ok)
      expect(json).to eq("teams" => [])
    end

    it "shows a renamed team under its new name" do
      other = FactoryBot.create(:team, race: race, name: "Before")
      other.update!(name: "After")

      get path
      expect(json["teams"].map { |t| t["name"] }).to eq(["After"])
    end

    it "reports a team with a NULL finalized column as not finalized" do
      other = FactoryBot.create(:team, race: race)
      other.update_column(:finalized, nil)

      get path
      expect(json["teams"].first["finalized"]).to be(false)
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: race)
      get "/api/v1/teams/#{other.id}/buddy_options"
      expect(response).to have_http_status(:forbidden)
    end

    context "as an operator" do
      let(:login_user) { FactoryBot.create(:operator_user) }

      it "returns the options for any team" do
        FactoryBot.create(:team, race: race, name: "Other")
        get path
        expect(response).to have_http_status(:ok)
        expect(json["teams"].map { |t| t["name"] }).to eq(["Other"])
      end
    end

    context "when logged out" do
      let(:login_user) { nil }

      it "returns 401" do
        get path
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
