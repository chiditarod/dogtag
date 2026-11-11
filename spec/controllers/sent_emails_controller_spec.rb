require "spec_helper"

describe SentEmailsController do
  let!(:team_a) { FactoryBot.create(:team) }
  let!(:team_b) { FactoryBot.create(:team) }
  let!(:mail_a) { SentEmail.create!(mailer: "TeamMailer", recipient: "a@b.com", kind: "team_finalized", status: "delivered", team_id: team_a.id) }
  let!(:mail_b) { SentEmail.create!(mailer: "TeamMailer", recipient: "c@d.com", kind: "registration_reminder", status: "bounced", team_id: team_b.id) }

  render_views

  before { activate_authlogic }

  describe "#index" do
    it "redirects to login when logged out" do
      get :index

      expect(response).to redirect_to(new_user_session_path)
    end

    context "as a racer" do
      before { login_user!(FactoryBot.create(:authlogic_user)) }

      it "is denied" do
        expect { get :index }.to raise_error(CanCan::AccessDenied)
      end
    end

    context "as an operator" do
      before { login_user!(FactoryBot.create(:operator_user)) }

      it "lists all rows" do
        get :index

        expect(response).to be_successful
        expect(assigns(:sent_emails)).to contain_exactly(mail_a, mail_b)
      end

      it "filters by team_id" do
        get :index, params: { team_id: team_a.id }

        expect(assigns(:sent_emails)).to contain_exactly(mail_a)
      end

      it "filters by status, kind and recipient" do
        get :index, params: { status: "bounced" }
        expect(assigns(:sent_emails)).to contain_exactly(mail_b)

        get :index, params: { kind: "team_finalized" }
        expect(assigns(:sent_emails)).to contain_exactly(mail_a)

        get :index, params: { recipient: "C@D" }
        expect(assigns(:sent_emails)).to contain_exactly(mail_b)
      end
    end

    context "as an admin" do
      before { login_user!(FactoryBot.create(:admin_user)) }

      it "is allowed" do
        get :index

        expect(response).to be_successful
      end
    end
  end
end
