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
  # reported as stalled so staff can retry them. Retrying marks them stalled first, so a payment is never
  # queued twice.
  def mark_stalled!
    return unless created_at <= STALL_AFTER.ago

    items.queued.update_all(status: "stalled", finished_at: Time.current, updated_at: Time.current)
  end
end
