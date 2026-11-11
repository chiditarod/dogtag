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

  it "creates a new Stripe customer when the saved one no longer exists" do
    user.update!(stripe_customer_id: "cus_gone")

    result = call

    expect(result.ok).to be(true)
    expect(CompletedRequirement.count).to eq(1)
    new_id = user.reload.stripe_customer_id
    expect(new_id).not_to eq("cus_gone")
    expect(result.completed_requirement.metadata).to include("customer_id" => new_id)
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

  context "when registration is closed" do
    before { requirement.race.update_column(:registration_close, 1.week.ago) }

    it "returns :registration_closed without calling Stripe" do
      expect(Stripe::Charge).not_to receive(:create)
      expect(Customer).not_to receive(:get)

      result = call

      expect(result.ok).to be(false)
      expect(result.error_code).to eq(:registration_closed)
      expect(result.message).to eq(I18n.t("api.errors.registration_closed"))
      expect(CompletedRequirement.count).to eq(0)
    end

    it "still allows an operator to take payment" do
      operator = FactoryBot.create(:operator_user)

      result = call(user: operator)

      expect(result.ok).to be(true)
      expect(CompletedRequirement.count).to eq(1)
    end
  end

  context "when the race is full and the team is waitlisted" do
    before { requirement.race.update_column(:max_teams, 0) }

    it "returns :race_full without calling Stripe" do
      expect(requirement.race.reload).to be_full
      expect(Stripe::Charge).not_to receive(:create)
      expect(Customer).not_to receive(:get)

      result = call

      expect(result.ok).to be(false)
      expect(result.error_code).to eq(:race_full)
      expect(result.message).to eq(I18n.t("charges.race_full"))
      expect(CompletedRequirement.count).to eq(0)
    end

    it "still allows an operator to take payment" do
      result = call(user: FactoryBot.create(:operator_user))

      expect(result.ok).to be(true)
      expect(CompletedRequirement.count).to eq(1)
    end
  end

  describe "expected_amount_cents" do
    it "returns :price_changed with the current price when it differs, without calling Stripe" do
      expect(Stripe::Charge).not_to receive(:create)
      expect(Customer).not_to receive(:get)

      result = call(expected_amount_cents: 4000)

      expect(result.ok).to be(false)
      expect(result.error_code).to eq(:price_changed)
      expect(result.message).to eq(I18n.t("charges.price_changed", amount: "$50.00"))
      expect(CompletedRequirement.count).to eq(0)
    end

    it "charges when it matches the current price" do
      result = call(expected_amount_cents: 5000)

      expect(result.ok).to be(true)
      expect(result.completed_requirement.metadata["amount"]).to eq(5000)
    end

    it "charges when it is absent" do
      expect(call(expected_amount_cents: nil).ok).to be(true)
    end
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
      expect(result.message).to eq(I18n.t("charges.duplicate_charge"))
      expect(Rails.logger).to have_received(:error).with(/duplicate charge.*test_ch/i)
    end

    it "returns :already_paid when a concurrent request recorded the requirement first" do
      allow(requirement).to receive(:completed?).and_return(false, true)
      allow(requirement).to receive(:complete).and_return(false)
      allow(Rails.logger).to receive(:error)

      result = call

      expect(result.error_code).to eq(:already_paid)
      expect(result.message).to eq(I18n.t("charges.duplicate_charge"))
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

  describe "when a step after saving raises but the completed requirement was committed" do
    it "returns success without a refund instruction" do
      allow_any_instance_of(CompletedRequirementAuditor).to receive(:create_completed_requirement_successful).and_raise("redis down")
      allow(Rails.logger).to receive(:error)

      result = call

      expect(result.ok).to be(true)
      expect(result.completed_requirement).to eq(CompletedRequirement.find_by!(team: team, requirement: requirement))
      expect(CompletedRequirement.count).to eq(1)
      expect(Rails.logger).to have_received(:error).with(/charge test_ch\w* was recorded.*redis down/i)
      expect(Rails.logger).not_to have_received(:error).with(/refund/i)
    end
  end

  describe "requirement types" do
    it "returns :not_payable for a plain requirement without touching Stripe" do
      plain = FactoryBot.create(:requirement, race: team.race)
      expect(Customer).not_to receive(:get)
      expect(Stripe::Charge).not_to receive(:create)

      result = call(requirement: plain)

      expect(result.error_code).to eq(:not_payable)
      expect(result.message).to eq(I18n.t("charges.not_payable"))
    end

    it "returns :not_payable for a mock payment requirement" do
      mock = MockPaymentRequirement.create!(name: "Mock", race: team.race)
      FactoryBot.create(:tier, requirement_id: mock.id)
      expect(Customer).not_to receive(:get)
      expect(Stripe::Charge).not_to receive(:create)

      expect(call(requirement: mock).error_code).to eq(:not_payable)
    end
  end

  describe "per-team advisory lock" do
    it "returns :in_progress without calling Stripe while another session holds the lock" do
      # a raw connection: pooled connections are shared with the example's transaction
      other = PG.connect(ActiveRecord::Base.connection.raw_connection.conninfo_hash.compact)
      begin
        expect(other.exec("SELECT pg_try_advisory_lock(#{team.id}, #{requirement.id})").getvalue(0, 0)).to eq("t")
        expect(Customer).not_to receive(:get)
        expect(Stripe::Charge).not_to receive(:create)

        result = call

        expect(result.ok).to be(false)
        expect(result.error_code).to eq(:in_progress)
        expect(result.message).to eq(I18n.t("charges.in_progress"))
        expect(CompletedRequirement.count).to eq(0)
      ensure
        other.close
      end
    end

    it "releases the lock after a failed charge" do
      StripeMock.prepare_card_error(:card_declined)
      expect(call.error_code).to eq(:card_error)

      other = PG.connect(ActiveRecord::Base.connection.raw_connection.conninfo_hash.compact)
      begin
        expect(other.exec("SELECT pg_try_advisory_lock(#{team.id}, #{requirement.id})").getvalue(0, 0)).to eq("t")
      ensure
        other.close
      end
    end
  end
end
