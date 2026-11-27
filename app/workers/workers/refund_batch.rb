module Workers
  # Refunds the queued items of a RefundBatch one at a time through Payments::RefundCharge. Finished and
  # stalled items are skipped, so a Sidekiq retry (or a second run) resumes where the first stopped and
  # never refunds or emails twice; RefundCharge is safe to repeat for the item that was in flight.
  class RefundBatch
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :important, retry: 3, backtrace: true

    def run(job, log)
      batch = ::RefundBatch.find(job["refund_batch_id"])

      batch.items.queued.order(:id).pluck(:id).each do |item_id|
        item = batch.items.find_by(id: item_id)
        # A retry may have marked the item stalled since the list was read.
        next unless item&.status == "queued"

        finish(item, batch, Payments::RefundCharge.call(user: batch.user, completed_requirement: item.completed_requirement))
      end

      batch.update!(finished_at: Time.current) unless batch.finished?
      log("complete", batch_id: batch.id)
    end

    private

    def finish(item, batch, result)
      status = if result.ok
        result.code == :already_refunded ? "already_refunded" : "refunded"
      else
        "failed"
      end
      error_code = (result.code.to_s unless result.ok)
      message = result.message
      if result.ok && batch.reopen
        reopened = Payments::ReopenPayment.call(user: batch.user, completed_requirement: item.completed_requirement)
        message = "#{message.chomp(".")}. #{reopened.message}"
        unless reopened.ok
          status = "reopen_failed"
          error_code = reopened.code.to_s
        end
      end
      item.update!(status: status, error_code: error_code, message: message, finished_at: Time.current)
    end
  end
end
