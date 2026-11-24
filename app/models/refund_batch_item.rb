class RefundBatchItem < ApplicationRecord
  STATUSES = %w[queued refunded already_refunded failed stalled].freeze

  belongs_to :refund_batch
  belongs_to :completed_requirement

  validates :status, inclusion: { in: STATUSES }

  scope :queued, -> { where(status: "queued") }
end
