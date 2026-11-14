require "spec_helper"
require "stripe_mock"

describe "API v1 payments", type: :request do
  let(:stripe_helper) { StripeMock.create_test_helper }
  let!(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let!(:user) { FactoryBot.create(:user) }
  let!(:team) { FactoryBot.create(:team, user: user, race: requirement.race) }
  let(:login_user) { user }
  let(:token) { stripe_helper.generate_card_token }
  let(:path) { "/api/v1/teams/#{team.id}/payments" }
  let(:params) { { requirement_id: requirement.id, stripe_token: token, stripe_email: user.email } }

  before do
    StripeMock.start
    api_login(login_user) if login_user
  end
  after { StripeMock.stop }

  describe "POST /api/v1/teams/:team_id/payments" do
    it "charges the active tier, records a completed requirement and returns the checklist" do
      expect(Stripe::Charge).to receive(:create).with(hash_including(amount: 5000)).and_call_original

      post path, params: params, as: :json

      expect(response).to have_http_status(:created)
      expect(json["checklist"]).to include("fee", "racers", "remaining")
      cr = CompletedRequirement.find_by!(team: team, requirement: requirement)
      expect(cr.metadata["amount"]).to eq(5000)
      expect(cr.user).to eq(user)
    end

    it "defaults stripe_email to the current user's email" do
      expect(Customer).to receive(:get).with(user, token, user.email).and_call_original
      post path, params: params.except(:stripe_email), as: :json
      expect(response).to have_http_status(:created)
    end

    it "returns 409 on a second payment without calling Stripe again" do
      post path, params: params, as: :json
      expect(response).to have_http_status(:created)

      expect(Stripe::Charge).not_to receive(:create)
      post path, params: params, as: :json

      expect(response).to have_http_status(:conflict)
      expect(json).to eq("error" => I18n.t("charges.already_paid"), "code" => "already_paid", "errors" => {})
      expect(CompletedRequirement.count).to eq(1)
    end

    it "returns 402 with Stripe's message on a card error and records nothing" do
      StripeMock.prepare_card_error(:card_declined)

      post path, params: params, as: :json

      expect(response).to have_http_status(:payment_required)
      expect(json).to eq("error" => "The card was declined", "code" => "card_error", "errors" => {})
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 422 when the requirement belongs to another race" do
      other = FactoryBot.create(:payment_requirement_with_tier)
      expect(Stripe::Charge).not_to receive(:create)

      post path, params: params.merge(requirement_id: other.id), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 422 when the requirement has no active tier" do
      bare = FactoryBot.create(:payment_requirement, race: team.race)

      post path, params: params.merge(requirement_id: bare.id), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 for a requirement that cannot be paid by card" do
      plain = FactoryBot.create(:requirement, race: team.race)
      expect(Stripe::Charge).not_to receive(:create)

      post path, params: params.merge(requirement_id: plain.id), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 409 when a payment for the team is already in progress" do
      allow(Payments::ChargeTeam).to receive(:call).and_return(
        Payments::ChargeTeam::Result.new(ok: false, error_code: :in_progress, message: I18n.t("charges.in_progress"), completed_requirement: nil)
      )

      post path, params: params, as: :json

      expect(response).to have_http_status(:conflict)
      expect(json).to include("error" => I18n.t("charges.in_progress"), "code" => "in_progress")
    end

    it "returns 409 with a duplicate_charge code when a concurrent request recorded the payment first" do
      allow_any_instance_of(CompletedRequirement).to receive(:save).and_raise(ActiveRecord::RecordNotUnique)

      post path, params: params, as: :json

      expect(response).to have_http_status(:conflict)
      expect(json).to include("error" => I18n.t("charges.duplicate_charge"), "code" => "duplicate_charge")
    end

    it "returns 502 when Stripe fails" do
      allow(Stripe::Charge).to receive(:create).and_raise(Stripe::APIConnectionError.new("down"))

      post path, params: params, as: :json

      expect(response).to have_http_status(:bad_gateway)
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 404 for an unknown requirement" do
      post path, params: params.merge(requirement_id: 0), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "returns 400 when stripe_token is missing" do
      post path, params: params.except(:stripe_token), as: :json
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: requirement.race)
      expect(Stripe::Charge).not_to receive(:create)

      post "/api/v1/teams/#{other.id}/payments", params: params, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 404 for an unknown team" do
      post "/api/v1/teams/0/payments", params: params, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "allows an admin to pay for any team" do
      admin = FactoryBot.create(:admin_user)
      post "/api/v1/session", params: { email: admin.email, password: "12345678" }, as: :json
      post path, params: params, as: :json
      expect(response).to have_http_status(:created)
    end

    context "when a refunder (not an owner)" do
      let(:login_user) { FactoryBot.create(:refunder_user) }

      it "returns 403" do
        post path, params: params, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when logged out" do
      let(:login_user) { nil }

      it "returns 401" do
        post path, params: params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "POST /api/v1/teams/:team_id/mock_payments" do
    let(:mock_path) { "/api/v1/teams/#{team.id}/mock_payments" }

    it "records a mock payment at the active tier amount and returns the checklist" do
      expect(Stripe::Charge).not_to receive(:create)

      post mock_path, params: { requirement_id: requirement.id }, as: :json

      expect(response).to have_http_status(:created)
      expect(json["checklist"]).to include("fee")
      cr = CompletedRequirement.find_by!(team: team, requirement: requirement)
      expect(cr.metadata).to include("amount" => 5000, "mock" => true, "charge_id" => a_string_starting_with("mock_ch_"))
    end

    it "returns 409 when already paid" do
      post mock_path, params: { requirement_id: requirement.id }, as: :json
      post mock_path, params: { requirement_id: requirement.id }, as: :json
      expect(response).to have_http_status(:conflict)
      expect(CompletedRequirement.count).to eq(1)
    end

    it "returns 402 for a mock decline" do
      post mock_path, params: { requirement_id: requirement.id, mock_behavior: "decline" }, as: :json
      expect(response).to have_http_status(:payment_required)
      expect(json).to include("error" => I18n.t("charges.mock_declined"), "code" => "card_error")
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 422 for a requirement from another race" do
      other = FactoryBot.create(:payment_requirement_with_tier)
      post mock_path, params: { requirement_id: other.id }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(CompletedRequirement.count).to eq(0)
    end

    it "returns 422 when the requirement has no active tier" do
      bare = FactoryBot.create(:payment_requirement, race: team.race)
      post mock_path, params: { requirement_id: bare.id }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 403 on another user's team" do
      other = FactoryBot.create(:team, race: requirement.race)
      post "/api/v1/teams/#{other.id}/mock_payments", params: { requirement_id: requirement.id }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(CompletedRequirement.count).to eq(0)
    end

    context "when logged out" do
      let(:login_user) { nil }

      it "returns 401" do
        post mock_path, params: { requirement_id: requirement.id }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
