class RefundBatchItem < ApplicationRecord
  # reopen_failed: refunded, but the batch also had to reopen it and that failed (see Workers::RefundBatch).
  STATUSES = %w[queued refunded already_refunded failed stalled reopen_failed].freeze

  belongs_to :refund_batch
  belongs_to :completed_requirement

  validates :status, inclusion: { in: STATUSES }

  scope :queued, -> { where(status: "queued") }
  # Queued items whose batch is stalled (see RefundBatch#reported_status).
  scope :stale, -> { queued.joins(:refund_batch).where(refund_batches: { created_at: ..RefundBatch.stall_cutoff }) }

  def self.mark_stalled! = update_all(status: "stalled", finished_at: Time.current, updated_at: Time.current)
end
