require "spec_helper"
require "stripe_mock"

describe Payments::RefundCharge do
  let(:stripe_helper) { StripeMock.create_test_helper }
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:team) { FactoryBot.create(:team, :with_enough_people, race: requirement.race) }
  let(:refunder) { FactoryBot.create(:refunder_user) }
  let(:charge) { Stripe::Charge.create(amount: 5000, currency: "usd", source: stripe_helper.generate_card_token) }
  let(:cr) { complete_with(charge.id) }

  before do
    StripeMock.start
    cr
  end
  after { StripeMock.stop }

  def complete_with(charge_id, req = requirement)
    req.complete(team.id, team.user, "charge_id" => charge_id, "customer_id" => "cus_1", "amount" => 5000)
  end

  def call(completed_requirement = cr)
    described_class.call(user: refunder, completed_requirement: completed_requirement)
  end

  def email_jobs = Workers::PaymentRefundedEmail.jobs

  it "refunds the charge and records who and when" do
    expect(Stripe::Refund).to receive(:create)
      .with(hash_including(charge: charge.id), hash_including(idempotency_key: "refund-#{cr.charge_id}"))
      .and_call_original

    result = Timecop.freeze(Time.utc(2026, 11, 24, 15, 0, 0)) { call }

    expect(result.ok).to be(true)
    expect(result.code).to eq(:refunded)
    cr.reload
    expect(cr.refunded_by).to eq(refunder)
    expect(cr.refunded_at).to eq(Time.utc(2026, 11, 24, 15, 0, 0))
    expect(cr.stripe_refund_id).to include("re_")
    expect(cr.metadata).to include("refunded" => true, "charge_id" => charge.id)
    expect(cr.payment_status).to eq("refunded")
    expect(Stripe::Charge.retrieve(charge.id).refunded).to be(true)
    expect(email_jobs.size).to eq(1)
    expect(email_jobs.first["args"].first).to include(
      "user_id" => team.user.id, "team_id" => team.id, "completed_requirement_id" => cr.id,
      "requirement_name" => requirement.name, "amount_cents" => 5000, "race_name" => team.race.name
    )
  end

  it "records a charge already refunded at Stripe as already_refunded and emails once" do
    Stripe::Refund.create(charge: charge.id)
    expect(Stripe::Refund).not_to receive(:create)

    result = call

    expect(result.ok).to be(true)
    expect(result.code).to eq(:already_refunded)
    cr.reload
    stripe_refund = Stripe::Charge.retrieve(charge.id).refunds.data.first
    expect(cr.refunded_at).to eq(Time.at(stripe_refund.created).utc)
    expect(cr.refunded_by).to be_nil
    expect(cr.stripe_refund_id).to eq(stripe_refund.id)
    expect(email_jobs.size).to eq(1)
  end

  describe "a charge refunded outside the app in several refunds" do
    def refunded_charge(refunds)
      Stripe::Charge.construct_from(id: charge.id, refunded: true, amount: 5000, amount_refunded: 5000, refunds: { data: refunds })
    end

    it "records the refund that covers the whole charge, whatever order Stripe lists them in" do
      full = { id: "re_full", amount: 5000, created: Time.utc(2026, 11, 2).to_i }
      allow(Stripe::Charge).to receive(:retrieve).and_return(refunded_charge([{ id: "re_x", amount: 100, created: Time.utc(2026, 11, 9).to_i }, full]))

      call

      cr.reload
      expect(cr.stripe_refund_id).to eq("re_full")
      expect(cr.refunded_at).to eq(Time.utc(2026, 11, 2))
      expect(cr.refunded_by).to be_nil
    end

    it "records the most recent refund when none covers the charge alone (the one that completed it)" do
      newest = { id: "re_new", amount: 2000, created: Time.utc(2026, 11, 9).to_i }
      oldest = { id: "re_old", amount: 3000, created: Time.utc(2026, 11, 2).to_i }
      allow(Stripe::Charge).to receive(:retrieve).and_return(refunded_charge([newest, oldest]))

      call

      expect(cr.reload.stripe_refund_id).to eq("re_new")
      expect(cr.refunded_at).to eq(Time.utc(2026, 11, 9))
    end

    it "falls back to now when Stripe lists no refund" do
      allow(Stripe::Charge).to receive(:retrieve).and_return(refunded_charge([]))

      Timecop.freeze(Time.utc(2026, 11, 24, 15)) { call }

      expect(cr.reload.refunded_at).to eq(Time.utc(2026, 11, 24, 15))
      expect(cr.stripe_refund_id).to be_nil
    end
  end

  it "returns already_refunded without calling Stripe when refunded_at is set" do
    cr.update!(refunded_at: 1.day.ago)
    expect(Stripe::Charge).not_to receive(:retrieve)
    expect(Stripe::Refund).not_to receive(:create)

    result = call

    expect(result.ok).to be(true)
    expect(result.code).to eq(:already_refunded)
    expect(email_jobs).to be_empty
  end

  it "records the refund even when the payer's account was deleted" do
    User.where(id: cr.user_id).delete_all

    result = call(CompletedRequirement.find(cr.id))

    expect(result.code).to eq(:refunded)
    cr.reload
    expect(cr.refunded_at).to be_present
    expect(cr.refunded_by).to eq(refunder)
    expect(cr.stripe_refund_id).to include("re_")
    expect(email_jobs.size).to eq(1)
  end

  it "a second call after a refund does nothing" do
    expect(call.code).to eq(:refunded)

    expect(Stripe::Refund).not_to receive(:create)
    expect(call.code).to eq(:already_refunded)
    expect(email_jobs.size).to eq(1)
  end

  it "returns partially_refunded and changes nothing" do
    partial = Stripe::Charge.construct_from(id: charge.id, refunded: false, amount: 5000, amount_refunded: 1000, refunds: { data: [] })
    allow(Stripe::Charge).to receive(:retrieve).and_return(partial)
    expect(Stripe::Refund).not_to receive(:create)

    result = call

    expect(result.ok).to be(false)
    expect(result.code).to eq(:partially_refunded)
    expect(result.message).to include("$10.00")
    expect(cr.reload.refunded_at).to be_nil
    expect(email_jobs).to be_empty
  end

  it "refuses with amount_mismatch when the charge is not the recorded amount, and does not call Stripe" do
    cr.update_columns(amount_cents: 4000)
    expect(Stripe::Refund).not_to receive(:create)

    result = call

    expect(result.ok).to be(false)
    expect(result.code).to eq(:amount_mismatch)
    expect(result.message).to include("$50.00", "$40.00")
    expect(cr.reload.refunded_at).to be_nil
    expect(email_jobs).to be_empty
  end

  it "refuses with amount_mismatch when the recorded amount is unknown" do
    cr.update_columns(amount_cents: nil)
    expect(Stripe::Refund).not_to receive(:create)

    expect(call.code).to eq(:amount_mismatch)
    expect(cr.reload.refunded_at).to be_nil
  end

  it "returns stripe_error with Stripe's reason for an unknown charge" do
    fake = FactoryBot.create(:completed_requirement, requirement: requirement, team: FactoryBot.create(:team, race: requirement.race), charge_id: "ch_seed_1")

    result = call(fake)

    expect(result.ok).to be(false)
    expect(result.code).to eq(:stripe_error)
    expect(result.message).to include("ch_seed_1")
    expect(fake.reload.refunded_at).to be_nil
    expect(email_jobs).to be_empty
  end

  it "returns stripe_error and alerts when Refund.create raises a connection error" do
    StripeMock.prepare_error(Stripe::APIConnectionError.new("timeout"), :new_refund)
    expect(Payments::AdvisoryLock).to receive(:alert).with(/Refund outcome unknown.*#{charge.id}.*team #{team.id}.*requirement #{requirement.id}/)

    result = call

    expect(result.ok).to be(false)
    expect(result.code).to eq(:stripe_error)
    expect(cr.reload.refunded_at).to be_nil
    expect(email_jobs).to be_empty
  end

  it "heals after an unknown outcome: the retry sees the refund at Stripe and records it" do
    # the refund happened at Stripe, but the first attempt died before recording it
    Stripe::Refund.create(charge: charge.id)

    expect(call.code).to eq(:already_refunded)
    expect(cr.reload.refunded_at).to be_present
    expect(email_jobs.size).to eq(1)
  end

  it "alerts and returns unexpected when saving fails after Stripe refunded" do
    allow_any_instance_of(CompletedRequirement).to receive(:update_columns).and_raise(ActiveRecord::StatementInvalid, "boom")
    expect(Payments::AdvisoryLock).to receive(:alert).with(/Refunded at Stripe but not recorded.*re_.*#{charge.id}/)

    result = call

    expect(result.ok).to be(false)
    expect(result.code).to eq(:unexpected)
    expect(email_jobs).to be_empty
  end

  it "still records the refund when queuing the email fails" do
    allow(Workers::PaymentRefundedEmail).to receive(:perform_async).and_raise(StandardError, "down")
    expect(Payments::AdvisoryLock).to receive(:alert).with(/refund email/i)

    result = call

    expect(result.code).to eq(:refunded)
    expect(cr.reload.refunded_at).to be_present
  end

  it "returns in_progress while the payment lock is held" do
    # a raw connection: pooled connections are shared with the example's transaction
    other = PG.connect(ActiveRecord::Base.connection.raw_connection.conninfo_hash.compact)
    begin
      expect(other.exec("SELECT pg_try_advisory_lock(#{team.id}, #{requirement.id})").getvalue(0, 0)).to eq("t")
      expect(Stripe::Charge).not_to receive(:retrieve)

      result = call

      expect(result.ok).to be(false)
      expect(result.code).to eq(:in_progress)
      expect(cr.reload.refunded_at).to be_nil
    ensure
      other.close
    end
  end

  it "returns not_refundable for a payment without a charge id" do
    cr.update_columns(charge_id: nil)

    expect(call.code).to eq(:not_refundable)
    expect(email_jobs).to be_empty
  end

  describe "a mock payment" do
    let(:mock_requirement) { MockPaymentRequirement.create!(name: "Mock fee", race: requirement.race) }
    let(:mock_cr) { complete_with("mock_ch_abc", mock_requirement) }

    it "refunds without Stripe outside production" do
      expect(Stripe::Charge).not_to receive(:retrieve)
      expect(Stripe::Refund).not_to receive(:create)

      result = call(mock_cr)

      expect(result.code).to eq(:refunded)
      mock_cr.reload
      expect(mock_cr.refunded_by).to eq(refunder)
      expect(mock_cr.refunded_at).to be_present
      expect(mock_cr.stripe_refund_id).to be_nil
      expect(email_jobs.size).to eq(1)
    end

    it "is never refunded without Stripe in production, even if the status check were bypassed" do
      mock_cr
      allow(Rails.env).to receive(:production?).and_return(true)
      allow_any_instance_of(CompletedRequirement).to receive(:payment_status).and_return("paid")
      expect(Stripe::Charge).not_to receive(:retrieve)

      result = call(mock_cr)

      expect(result.code).to eq(:not_refundable)
      expect(mock_cr.reload.refunded_at).to be_nil
      expect(email_jobs).to be_empty
    end

    it "is not_refundable in production" do
      mock_cr
      allow(Rails.env).to receive(:production?).and_return(true)
      expect(Stripe::Charge).not_to receive(:retrieve)

      result = call(mock_cr)

      expect(result.code).to eq(:not_refundable)
      expect(mock_cr.reload.refunded_at).to be_nil
    end
  end
end
