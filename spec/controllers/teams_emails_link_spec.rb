require "spec_helper"

describe TeamsController do
  render_views

  let(:team) { FactoryBot.create(:team) }

  before { activate_authlogic }

  describe "#show emails link" do
    it "is shown to operators" do
      login_user!(FactoryBot.create(:operator_user))
      get :show, params: { id: team.id }

      expect(response.body).to include(sent_emails_path(team_id: team.id))
    end

    it "is hidden from the team owner" do
      login_user!(team.user)
      get :show, params: { id: team.id }

      expect(response).to be_successful
      expect(response.body).not_to include("/sent_emails")
    end
  end
end
