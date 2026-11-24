# Validates a staff member's selection of payments and queues it as a RefundBatch for Workers::RefundBatch.
# The server owns every limit the dialog shows: the batch cap, the typed confirmation, and the total the
# staff member reviewed. Nothing is queued unless every check passes (all or nothing).
module Payments
  class QueueRefundBatch
    Result = Data.define(:ok, :code, :errors, :batch)

    ERRORS_BY_STATUS = {
      "refunded" => "already refunded",
      "refunding" => "being refunded",
      "not_refundable" => "not refundable"
    }.freeze

    def self.call(user:, completed_requirement_ids:, confirmation:, expected_total_cents:)
      ids = normalize(completed_requirement_ids)
      return failure(:bad_request) if ids.nil? || ids.empty? || ids.uniq.size != ids.size
      return failure(:batch_too_large) if ids.size > RefundBatch.max_size
      return failure(:confirmation_mismatch) unless confirmation == "REFUND #{ids.size}"

      payments = payments_by_id(ids)
      errors = refusals(ids, payments)
      return failure(:not_refundable, errors) if errors.any?
      return failure(:selection_changed) if expected_total_cents.to_s != payments.values.sum { |cr| cr.amount_cents.to_i }.to_s

      queue(user, ids)
    end

    # Re-queues the failed and stalled items of a batch the staff member already confirmed, as a new batch.
    # Items whose payment has since been refunded (or is in another batch) are left out.
    def self.retry(user:, batch:)
      batch.mark_stalled!
      candidate_ids = batch.items.where(status: %w[failed stalled]).pluck(:completed_requirement_id)
      ids = payments_by_id(candidate_ids).select { |_, cr| cr.payment_status == "paid" }.keys.sort
      return failure(:nothing_to_retry) if ids.empty?
      return failure(:batch_too_large) if ids.size > RefundBatch.max_size

      queue(user, ids, retry_of: batch)
    end

    def self.normalize(ids)
      return nil unless ids.is_a?(Array)

      ids = ids.map { |id| Integer(id.to_s, 10, exception: false) }
      ids.any?(&:nil?) ? nil : ids
    end
    private_class_method :normalize

    def self.payments_by_id(ids)
      CompletedRequirement.joins(:requirement)
        .select("completed_requirements.*", "#{CompletedRequirement.payment_status_sql} AS payment_status")
        .where(id: ids).index_by(&:id)
    end
    private_class_method :payments_by_id

    # { "<id>" => ["already refunded"] } for every id that cannot be queued.
    def self.refusals(ids, payments)
      ids.each_with_object({}) do |id, errors|
        cr = payments[id]
        reason = cr.nil? ? "not found" : ERRORS_BY_STATUS[cr.payment_status]
        errors[id.to_s] = [reason] if reason
      end
    end
    private_class_method :refusals

    def self.queue(user, ids, retry_of: nil)
      batch = RefundBatch.transaction do
        RefundBatch.create!(user: user, retry_of: retry_of).tap do |created|
          ids.each { |id| RefundBatchItem.create!(refund_batch: created, completed_requirement_id: id, status: "queued") }
        end
      end
      enqueue(batch)
      Result.new(ok: true, code: nil, errors: {}, batch: batch)
    rescue ActiveRecord::RecordNotUnique
      # Another request queued one of these payments between our check and the insert.
      failure(:not_refundable, ids.to_h { |id| [id.to_s, ["being refunded"]] })
    end
    private_class_method :queue

    # After the commit, so the worker can see the batch. If Redis is down the items stay queued and show as
    # stalled after RefundBatch::STALL_AFTER, when staff can retry them.
    def self.enqueue(batch)
      Workers::RefundBatch.perform_async("refund_batch_id" => batch.id)
    rescue => e
      AdvisoryLock.alert("Refund batch #{batch.id} was saved but not enqueued (#{e.class}: #{e.message}). Its items show as stalled after 10 minutes; retry them.")
    end
    private_class_method :enqueue

    def self.failure(code, errors = {})
      Result.new(ok: false, code: code, errors: errors, batch: nil)
    end
    private_class_method :failure
  end
end
