# A staff request to refund several payments in the background. Each payment is a RefundBatchItem.
class RefundBatch < ApplicationRecord
  DEFAULT_MAX_SIZE = 5
  STALL_AFTER = 10.minutes

  belongs_to :user
  belongs_to :retry_of, class_name: "RefundBatch", optional: true
  has_many :items, class_name: "RefundBatchItem", dependent: :delete_all

  # The most payments one batch may hold, from REFUND_BATCH_LIMIT. This is the only place that reads it.
  # Anything that is not a positive integer falls back to the default.
  def self.max_size
    value = Integer(ENV["REFUND_BATCH_LIMIT"].to_s.strip, 10, exception: false)
    value&.positive? ? value : DEFAULT_MAX_SIZE
  end

  def finished? = finished_at.present?

  # Items still queued long after the batch was created (the worker died, or Sidekiq lost the job) are
  # reported as stalled so staff can retry them. Reading a batch never writes: the report is derived here.
  # A late-running job may still refund such an item, which is safe (see Payments::RefundCharge).
  def reported_status(item)
    item.status == "queued" && stalled? ? "stalled" : item.status
  end

  def stalled? = created_at <= self.class.stall_cutoff

  # A batch created at or before this time is stalled. Shared with CompletedRequirement.payment_status_sql
  # and RefundBatchItem.stale so they all agree.
  def self.stall_cutoff = STALL_AFTER.ago

  # Only a retry rewrites stalled items, right before it re-queues them, so a payment is never queued twice.
  # The unique index on queued items and RefundCharge's lock and Stripe check keep a late original job from
  # refunding it a second time.
  def mark_stalled!
    return unless stalled?

    items.queued.mark_stalled!
  end
end
