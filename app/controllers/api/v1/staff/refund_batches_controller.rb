class Api::V1::Staff::RefundBatchesController < Api::V1::Staff::BaseController
  STATUS_BY_CODE = { bad_request: :bad_request }.freeze

  def create
    ids = params.expect(completed_requirement_ids: [])
    reopen = ActiveModel::Type::Boolean.new.cast(params[:reopen]) || false
    # Refunders may refund but not reopen (operators and admins only).
    authorize!(:reopen, :charges) if reopen
    result = Payments::QueueRefundBatch.call(
      user: current_user,
      completed_requirement_ids: ids,
      confirmation: params[:confirmation].to_s,
      expected_total_cents: params[:expected_total_cents],
      reopen: reopen
    )
    render_batch(result, ids.size)
  end

  def retry_failed
    batch = RefundBatch.find(params[:id])
    # Retrying a reopen batch reopens too, so it needs the same permission as starting one.
    authorize!(:reopen, :charges) if batch.reopen
    render_batch(Payments::QueueRefundBatch.retry(user: current_user, batch: batch))
  end

  # Staff can read any batch. A GET never writes: items still queued long after the batch was created are
  # only reported as stalled (RefundBatch#reported_status).
  def show
    @batch = RefundBatch.includes(items: { completed_requirement: [:requirement, :team] }).find(params[:id])
  end

  private

  def render_batch(result, count = nil)
    if result.ok
      @batch = RefundBatch.includes(items: { completed_requirement: [:requirement, :team] }).find(result.batch.id)
      render :show, status: :created
    else
      render json: { error: error_message(result.code, count), errors: result.errors, code: result.code.to_s }, status: STATUS_BY_CODE.fetch(result.code, :unprocessable_entity)
    end
  end

  def error_message(code, count)
    case code
    when :batch_too_large then "You can refund at most #{RefundBatch.max_size} payments at a time."
    when :confirmation_mismatch then "Type REFUND #{count} to confirm."
    when :invalid_total then "expected_total_cents must be a whole number of cents."
    when :selection_changed then "The selection changed since you reviewed it. Review it again."
    when :not_refundable then "Some of these payments cannot be refunded."
    when :nothing_to_retry then "Nothing to retry."
    else "bad_request"
    end
  end
end
