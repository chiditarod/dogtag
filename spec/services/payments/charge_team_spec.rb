require "spec_helper"
require "stripe_mock"

describe Payments::ChargeTeam do
  let(:stripe_helper) { StripeMock.create_test_helper }
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:team) { FactoryBot.create(:team, race: requirement.race) }
  let(:user) { team.user }
  let(:token) { stripe_helper.generate_card_token }

  before { StripeMock.start }
  after { StripeMock.stop }

  def call(overrides = {})
    described_class.call(
      **{ user: user, team: team, requirement: requirement, stripe_token: token, stripe_email: user.email }.merge(overrides)
    )
  end

  it "charges the active tier amount and records a completed requirement" do
    expect(Stripe::Charge).to receive(:create)
      .with(hash_including(amount: 5000, currency: "usd", metadata: hash_including("team_id" => team.id, "requirement_id" => requirement.id)))
      .and_call_original

    result = call

    expect(result.ok).to be(true)
    expect(result.error_code).to be_nil
    cr = result.completed_requirement
    expect(cr).to be_persisted
    expect(cr.team).to eq(team)
    expect(cr.requirement).to eq(requirement)
    expect(cr.user).to eq(user)
    expect(cr.metadata).to include("amount" => 5000, "charge_id" => a_string_starting_with("test_ch"), "customer_id" => user.reload.stripe_customer_id)
  end

  it "does not call Stripe and returns :already_paid when the requirement is already completed" do
    expect(call.ok).to be(true)

    expect(Stripe::Charge).not_to receive(:create)
    expect(Customer).not_to receive(:get)
    result = call

    expect(result.ok).to be(false)
    expect(result.error_code).to eq(:already_paid)
    expect(result.message).to eq(I18n.t("charges.already_paid"))
    expect(CompletedRequirement.count).to eq(1)
  end

  it "rejects a requirement from another race without calling Stripe" do
    other = FactoryBot.create(:payment_requirement_with_tier)
    expect(Stripe::Charge).not_to receive(:create)
    expect(Customer).not_to receive(:get)

    result = call(requirement: other)

    expect(result.error_code).to eq(:wrong_race)
    expect(result.ok).to be(false)
    expect(CompletedRequirement.count).to eq(0)
  end

  it "returns :no_active_tier without calling Stripe when no tier is active" do
    bare = FactoryBot.create(:payment_requirement, race: team.race)
    expect(Stripe::Charge).not_to receive(:create)
    expect(Customer).not_to receive(:get)

    result = call(requirement: bare)

    expect(result.error_code).to eq(:no_active_tier)
    expect(result.message).to eq(I18n.t("charges.no_active_price"))
  end

  it "returns :customer_failed when no Stripe customer can be found or created" do
    allow(Customer).to receive(:get).and_return(nil)
    expect(Stripe::Charge).not_to receive(:create)

    result = call

    expect(result.error_code).to eq(:customer_failed)
    expect(result.message).to eq(I18n.t("charges.unable_to_get_customer"))
  end

  it "returns :card_error with Stripe's message and records nothing" do
    StripeMock.prepare_card_error(:card_declined)

    result = call

    expect(result.ok).to be(false)
    expect(result.error_code).to eq(:card_error)
    expect(result.message).to eq("The card was declined")
    expect(CompletedRequirement.count).to eq(0)
  end

  {
    "an invalid request" => [Stripe::InvalidRequestError.new("bad", :foo), /Invalid parameters supplied to Stripe API.*bad/],
    "an API connection error" => [Stripe::APIConnectionError.new("down"), /issue connecting to the Stripe API: down/],
    "a generic Stripe error" => [Stripe::StripeError.new("boom"), /error occured connecting to Stripe/]
  }.each do |name, (error, message)|
    it "returns :stripe_error for #{name}" do
      allow(Stripe::Charge).to receive(:create).and_raise(error)

      result = call

      expect(result.error_code).to eq(:stripe_error)
      expect(result.message).to match(message)
      expect(CompletedRequirement.count).to eq(0)
    end
  end

  it "returns :unexpected for any other error" do
    allow(Stripe::Charge).to receive(:create).and_raise("kaboom")

    result = call

    expect(result.error_code).to eq(:unexpected)
    expect(result.message).to match(/unrelated to processing your credit card/)
  end

  describe "when the completed requirement cannot be saved after a successful charge" do
    it "logs the charge id loudly and returns :already_paid on a unique index violation" do
      allow_any_instance_of(CompletedRequirement).to receive(:save).and_raise(ActiveRecord::RecordNotUnique)
      allow(Rails.logger).to receive(:error)

      result = call

      expect(result.ok).to be(false)
      expect(result.error_code).to eq(:already_paid)
      expect(Rails.logger).to have_received(:error).with(/duplicate charge.*test_ch/i)
    end

    it "returns :already_paid when a concurrent request recorded the requirement first" do
      allow(requirement).to receive(:completed?).and_return(false, true)
      allow(requirement).to receive(:complete).and_return(false)
      allow(Rails.logger).to receive(:error)

      result = call

      expect(result.error_code).to eq(:already_paid)
      expect(Rails.logger).to have_received(:error).with(/duplicate charge.*test_ch/i)
    end

    it "returns :unexpected and logs the charge id when the record is not saved for another reason" do
      allow(requirement).to receive(:complete).and_return(false)
      allow(Rails.logger).to receive(:error)

      result = call

      expect(result.error_code).to eq(:unexpected)
      expect(Rails.logger).to have_received(:error).with(/charged but not recorded.*test_ch/i)
    end
  end
end
