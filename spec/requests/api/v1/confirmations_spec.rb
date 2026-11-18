require "spec_helper"

describe "API v1 confirmations", type: :request do
  let!(:user) { FactoryBot.create(:user) }
  let!(:race) { FactoryBot.create(:race) }
  let!(:team) { FactoryBot.create(:team, user: user, race: race).tap { |t| t.update_columns(finalized: true) } }
  let(:path) { "/api/v1/teams/#{team.id}/confirmation" }
  let(:login_user) { user }

  before { api_login(login_user) if login_user }

  it "marks it seen for the owner" do
    post path, as: :json

    expect(response).to have_http_status(:ok)
    expect(team.reload.confirmation_seen_at).to be_present
    expect(json.dig("checklist", "show_confirmation")).to be(false)
  end

  it "is idempotent" do
    first = Time.zone.local(2026, 5, 1, 12)
    Timecop.freeze(first) { post path, as: :json }
    Timecop.freeze(first + 1.day) { post path, as: :json }

    expect(response).to have_http_status(:ok)
    expect(team.reload.confirmation_seen_at).to eq(first)
  end

  it "works after registration closes" do
    race.update_columns(registration_close: 1.week.ago)

    post path, as: :json

    expect(response).to have_http_status(:ok)
    expect(team.reload.confirmation_seen_at).to be_present
  end

  context "as an admin" do
    let(:login_user) { FactoryBot.create(:admin_user) }

    it "does not let staff use it up" do
      post path, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(json).to include("error" => be_present, "errors" => {})
      expect(team.reload.confirmation_seen_at).to be_nil
    end
  end

  context "as an operator" do
    let(:login_user) { FactoryBot.create(:operator_user) }

    it "does not let staff use it up" do
      post path, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(team.reload.confirmation_seen_at).to be_nil
    end
  end

  context "as another user" do
    let(:login_user) { FactoryBot.create(:user) }

    it "refuses and leaves the column alone" do
      post path, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(team.reload.confirmation_seen_at).to be_nil
    end
  end

  context "when logged out" do
    let(:login_user) { nil }

    it "returns 401" do
      post path, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
