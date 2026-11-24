require "spec_helper"
require "stripe_mock"

describe Workers::RefundBatch do
  let(:stripe_helper) { StripeMock.create_test_helper }
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:refunder) { FactoryBot.create(:refunder_user) }
  let(:batch) { FactoryBot.create(:refund_batch, user: refunder) }

  before { StripeMock.start }
  after { StripeMock.stop }

  def paid(charge_id: Stripe::Charge.create(amount: 5000, currency: "usd", source: stripe_helper.generate_card_token).id)
    team = FactoryBot.create(:team, race: requirement.race)
    requirement.complete(team.id, team.user, "charge_id" => charge_id, "customer_id" => "cus_1", "amount" => 5000)
  end

  def queue_item(cr, status: "queued")
    FactoryBot.create(:refund_batch_item, refund_batch: batch, completed_requirement: cr, status: status)
  end

  def run_worker = described_class.new.perform("refund_batch_id" => batch.id)

  it "refunds every queued item and finishes the batch" do
    items = Array.new(3) { queue_item(paid) }

    run_worker

    expect(items.map { |item| item.reload.status }).to eq(%w[refunded refunded refunded])
    expect(items.map(&:finished_at)).to all(be_present)
    items.each do |item|
      cr = item.completed_requirement.reload
      expect(cr).to be_refunded
      expect(cr.refunded_by).to eq(refunder)
    end
    expect(batch.reload).to be_finished
    expect(Workers::PaymentRefundedEmail.jobs.size).to eq(3)
  end

  it "records an already refunded charge as already_refunded" do
    cr = paid
    Stripe::Refund.create(charge: cr.charge_id)
    item = queue_item(cr)

    run_worker

    expect(item.reload.status).to eq("already_refunded")
    expect(cr.reload).to be_refunded
  end

  it "records failed with error_code and message" do
    item = queue_item(paid(charge_id: "ch_seed_1"))

    run_worker

    item.reload
    expect(item.status).to eq("failed")
    expect(item.error_code).to eq("stripe_error")
    expect(item.message).to include("ch_seed_1")
    expect(item.finished_at).to be_present
    expect(batch.reload).to be_finished
  end

  it "keeps going after one item fails" do
    bad = queue_item(paid(charge_id: "ch_seed_2"))
    good = queue_item(paid)

    run_worker

    expect(bad.reload.status).to eq("failed")
    expect(good.reload.status).to eq("refunded")
  end

  it "resumes after a mid-batch failure without refunding or emailing twice" do
    items = Array.new(3) { queue_item(paid) }
    calls = 0
    allow(Payments::RefundCharge).to receive(:call).and_wrap_original do |original, **args|
      calls += 1
      raise "worker killed" if calls == 2

      original.call(**args)
    end
    expect(Stripe::Refund).to receive(:create).exactly(3).times.and_call_original

    expect { run_worker }.to raise_error("worker killed")
    expect(items.map { |item| item.reload.status }).to eq(%w[refunded queued queued])
    expect(batch.reload).not_to be_finished

    run_worker

    expect(items.map { |item| item.reload.status }).to eq(%w[refunded refunded refunded])
    expect(batch.reload).to be_finished
    expect(Workers::PaymentRefundedEmail.jobs.size).to eq(3)
  end

  it "skips an item already marked stalled" do
    stalled = queue_item(paid, status: "stalled")
    expect(Stripe::Refund).not_to receive(:create)

    run_worker

    expect(stalled.reload.status).to eq("stalled")
    expect(stalled.completed_requirement.reload).not_to be_refunded
  end

  it "skips an item whose payment was deleted mid-batch (Refund and invalidate) and finishes the rest" do
    first = queue_item(paid)
    deleted = queue_item(paid)
    last = queue_item(paid)
    deleted_cr = deleted.completed_requirement
    allow(Payments::RefundCharge).to receive(:call).and_wrap_original do |original, **args|
      result = original.call(**args)
      # An admin's "Refund and invalidate" deletes the payment (and its batch items) while the job runs.
      deleted_cr.destroy if args[:completed_requirement].id == first.completed_requirement_id
      result
    end

    expect { run_worker }.not_to raise_error

    expect(RefundBatchItem.exists?(deleted.id)).to be(false)
    expect([first.reload.status, last.reload.status]).to eq(%w[refunded refunded])
    expect(Payments::RefundCharge).to have_received(:call).twice
    expect(batch.reload).to be_finished
  end

  it "a late-running job still refunds an item that only looked stalled" do
    start = Time.utc(2026, 11, 24, 12, 0, 0)
    old_batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
    item = FactoryBot.create(:refund_batch_item, refund_batch: old_batch, completed_requirement: paid)

    Timecop.freeze(start + 11.minutes) do
      expect(old_batch.items.reload.pluck(:status)).to eq(["queued"])
      described_class.new.perform("refund_batch_id" => old_batch.id)
    end

    expect(item.reload.status).to eq("refunded")
    expect(item.completed_requirement.reload).to be_refunded
  end

  it "retrying a stalled batch and then running the original job never refunds twice" do
    start = Time.utc(2026, 11, 24, 12, 0, 0)
    old_batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
    cr = paid
    old_item = FactoryBot.create(:refund_batch_item, refund_batch: old_batch, completed_requirement: cr)
    expect(Stripe::Refund).to receive(:create).once.and_call_original

    Timecop.freeze(start + 11.minutes) do
      retry_result = Payments::QueueRefundBatch.retry(user: refunder, batch: old_batch)
      expect(old_item.reload.status).to eq("stalled")
      new_item = retry_result.batch.items.first

      described_class.new.perform("refund_batch_id" => retry_result.batch.id)
      described_class.new.perform("refund_batch_id" => old_batch.id)

      expect(new_item.reload.status).to eq("refunded")
      expect(old_item.reload.status).to eq("stalled")
    end
    expect(Workers::PaymentRefundedEmail.jobs.size).to eq(1)
  end

  it "an original job that was already in flight, then the retried batch, refunds once" do
    start = Time.utc(2026, 11, 24, 12, 0, 0)
    old_batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
    cr = paid
    FactoryBot.create(:refund_batch_item, refund_batch: old_batch, completed_requirement: cr)
    expect(Stripe::Refund).to receive(:create).once.and_call_original

    Timecop.freeze(start + 11.minutes) do
      retry_result = Payments::QueueRefundBatch.retry(user: refunder, batch: old_batch)
      new_item = retry_result.batch.items.first
      # the original job was already in flight when the retry marked its item stalled, and refunds first
      Payments::RefundCharge.call(user: refunder, completed_requirement: cr.reload)

      described_class.new.perform("refund_batch_id" => retry_result.batch.id)

      expect(new_item.reload.status).to eq("already_refunded")
    end
  end

  it "rerunning a finished batch does nothing" do
    queue_item(paid)
    run_worker
    finished_at = batch.reload.finished_at

    expect(Stripe::Refund).not_to receive(:create)
    Timecop.travel(1.hour.from_now) { run_worker }

    expect(batch.reload.finished_at).to eq(finished_at)
    expect(Workers::PaymentRefundedEmail.jobs.size).to eq(1)
  end

  it "runs end to end from the queue service and emails each team once" do
    crs = Array.new(2) { paid }

    Sidekiq::Testing.inline! do
      result = Payments::QueueRefundBatch.call(
        user: refunder, completed_requirement_ids: crs.map(&:id), confirmation: "REFUND 2", expected_total_cents: 10_000
      )
      expect(result.ok).to be(true)
      expect(result.batch.reload).to be_finished
      expect(result.batch.items.pluck(:status)).to eq(%w[refunded refunded])
    end

    expect(crs.map { |cr| cr.reload.refunded? }).to eq([true, true])
    expect(ActionMailer::Base.deliveries.size).to eq(2)
    expect(SentEmail.where(kind: "refund").count).to eq(2)
  end
end
