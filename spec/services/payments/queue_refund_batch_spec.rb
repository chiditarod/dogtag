require "spec_helper"
require "stripe_mock"

describe Payments::QueueRefundBatch do
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:refunder) { FactoryBot.create(:refunder_user) }

  def paid(charge_id: "ch_#{SecureRandom.hex(4)}", amount: 5000, **attrs)
    team = FactoryBot.create(:team, race: requirement.race)
    FactoryBot.create(:completed_requirement, requirement: requirement, team: team, charge_id: charge_id, amount_cents: amount, **attrs)
  end

  def queue(ids, confirmation: "REFUND #{ids.size}", total: nil, user: refunder)
    crs = CompletedRequirement.where(id: ids)
    total ||= crs.sum(:amount_cents)
    described_class.call(user: user, completed_requirement_ids: ids, confirmation: confirmation, expected_total_cents: total)
  end

  def no_batch_created
    expect { yield }.not_to change { [RefundBatch.count, RefundBatchItem.count] }
  end

  describe ".call" do
    it "queues a batch with one queued item per payment and enqueues the job after commit" do
      crs = [paid, paid]

      result = queue(crs.map(&:id))

      expect(result.ok).to be(true)
      batch = result.batch
      expect(batch.user).to eq(refunder)
      expect(batch.items.pluck(:completed_requirement_id)).to match_array(crs.map(&:id))
      expect(batch.items.pluck(:status).uniq).to eq(["queued"])
      expect(Workers::RefundBatch.jobs.size).to eq(1)
      expect(Workers::RefundBatch.jobs.first["args"]).to eq([{ "refund_batch_id" => batch.id }])
      expect(crs.map { |cr| cr.payment_status }.uniq).to eq(["refunding"])
    end

    it "accepts the ids as strings" do
      cr = paid

      expect(queue([cr.id.to_s], total: 5000).ok).to be(true)
    end

    it "rejects 6 ids when the limit is 5" do
      ids = Array.new(6) { paid.id }

      no_batch_created { expect(queue(ids).code).to eq(:batch_too_large) }
      expect(Workers::RefundBatch.jobs).to be_empty
    end

    it "accepts 10 ids when REFUND_BATCH_LIMIT is 10" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("REFUND_BATCH_LIMIT").and_return("10")
      ids = Array.new(10) { paid.id }

      expect(queue(ids).ok).to be(true)
    end

    it "rejects a confirmation that is not exactly REFUND <count>" do
      ids = [paid.id, paid.id]

      no_batch_created do
        expect(queue(ids, confirmation: "REFUND 3").code).to eq(:confirmation_mismatch)
        expect(queue(ids, confirmation: "refund 2").code).to eq(:confirmation_mismatch)
        expect(queue(ids, confirmation: "REFUND 2 ").code).to eq(:confirmation_mismatch)
      end
    end

    it "rejects a total that differs from the server's sum as selection_changed" do
      ids = [paid.id, paid(amount: 2500).id]

      no_batch_created do
        result = queue(ids, total: 5000)
        expect(result.ok).to be(false)
        expect(result.code).to eq(:selection_changed)
      end
    end

    it "reports not_refundable with errors keyed by id for refunded, refunding, not refundable and unknown ids" do
      refunded = paid(refunded_at: 1.day.ago)
      refunding = paid
      FactoryBot.create(:refund_batch_item, completed_requirement: refunding)
      without_charge = paid(charge_id: nil)
      good = paid
      unknown = CompletedRequirement.maximum(:id) + 1000

      no_batch_created do
        result = queue([refunded.id, refunding.id, without_charge.id, good.id, unknown], total: 0)

        expect(result.ok).to be(false)
        expect(result.code).to eq(:not_refundable)
        expect(result.errors).to eq(
          refunded.id.to_s => ["already refunded"],
          refunding.id.to_s => ["being refunded"],
          without_charge.id.to_s => ["not refundable"],
          unknown.to_s => ["not found"]
        )
      end
    end

    it "queues nothing when any id is bad" do
      good = paid
      bad = paid(refunded_at: 1.day.ago)

      no_batch_created { expect(queue([good.id, bad.id]).code).to eq(:not_refundable) }
      expect(good.reload.payment_status).to eq("paid")
      expect(Workers::RefundBatch.jobs).to be_empty
    end

    it "a second batch for a queued payment is not_refundable and queues nothing" do
      cr = paid
      expect(queue([cr.id]).ok).to be(true)
      Workers::RefundBatch.jobs.clear

      no_batch_created do
        result = queue([cr.id])
        expect(result.code).to eq(:not_refundable)
        expect(result.errors).to eq(cr.id.to_s => ["being refunded"])
      end
      expect(Workers::RefundBatch.jobs).to be_empty
    end

    it "maps losing the race on the queued-item index to not_refundable" do
      ids = [paid.id, paid.id]
      allow(RefundBatchItem).to receive(:create!).and_raise(ActiveRecord::RecordNotUnique)

      no_batch_created do
        result = queue(ids)
        expect(result.code).to eq(:not_refundable)
        expect(result.errors.keys).to match_array(ids.map(&:to_s))
        expect(result.errors.values.uniq).to eq([["being refunded"]])
      end
    end

    it "rejects empty and duplicate ids as bad_request" do
      cr = paid

      no_batch_created do
        expect(queue([], confirmation: "REFUND 0", total: 0).code).to eq(:bad_request)
        expect(queue([cr.id, cr.id], total: 10_000).code).to eq(:bad_request)
        expect(queue(["abc"], confirmation: "REFUND 1", total: 0).code).to eq(:bad_request)
      end
    end

    it "still queues when the job cannot be enqueued, and alerts" do
      cr = paid
      allow(Workers::RefundBatch).to receive(:perform_async).and_raise(StandardError, "redis down")
      expect(Payments::AdvisoryLock).to receive(:alert).with(/Refund batch \d+ was saved but not enqueued/)

      result = queue([cr.id])

      expect(result.ok).to be(true)
      expect(result.batch.items.count).to eq(1)
    end
  end

  describe ".retry" do
    let(:batch) { FactoryBot.create(:refund_batch, user: refunder) }

    def item(cr, status)
      FactoryBot.create(:refund_batch_item, refund_batch: batch, completed_requirement: cr, status: status)
    end

    it "re-queues failed and stalled items as a new batch with retry_of" do
      failed = item(paid, "failed")
      stalled = item(paid, "stalled")
      item(paid, "refunded")

      result = described_class.retry(user: refunder, batch: batch)

      expect(result.ok).to be(true)
      expect(result.batch.retry_of).to eq(batch)
      expect(result.batch.items.pluck(:completed_requirement_id)).to match_array([failed.completed_requirement_id, stalled.completed_requirement_id])
      expect(result.batch.items.pluck(:status).uniq).to eq(["queued"])
      expect(Workers::RefundBatch.jobs.size).to eq(1)
    end

    it "marks stale queued items stalled first, then retries them" do
      start = Time.utc(2026, 11, 24, 12, 0, 0)
      old_batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch, user: refunder) }
      stuck = FactoryBot.create(:refund_batch_item, refund_batch: old_batch, completed_requirement: paid)

      result = Timecop.freeze(start + 11.minutes) { described_class.retry(user: refunder, batch: old_batch) }

      expect(result.ok).to be(true)
      expect(stuck.reload.status).to eq("stalled")
      expect(result.batch.items.pluck(:completed_requirement_id)).to eq([stuck.completed_requirement_id])
    end

    it "skips an item that has since been refunded" do
      item(paid(refunded_at: 1.hour.ago), "failed")
      still_failed = item(paid, "failed")

      result = described_class.retry(user: refunder, batch: batch)

      expect(result.batch.items.pluck(:completed_requirement_id)).to eq([still_failed.completed_requirement_id])
    end

    it "returns nothing_to_retry when no item can be retried" do
      item(paid(refunded_at: 1.hour.ago), "failed")
      item(paid, "refunded")

      no_batch_created { expect(described_class.retry(user: refunder, batch: batch).code).to eq(:nothing_to_retry) }
    end

    it "is still capped" do
      allow(RefundBatch).to receive(:max_size).and_return(1)
      item(paid, "failed")
      item(paid, "failed")

      no_batch_created { expect(described_class.retry(user: refunder, batch: batch).code).to eq(:batch_too_large) }
    end
  end
end
