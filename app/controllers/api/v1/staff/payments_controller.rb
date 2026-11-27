class Api::V1::Staff::PaymentsController < Api::V1::Staff::BaseController
  def index
    @search = Payments::PaymentSearch.new(
      race_id: params[:race_id], payment_type: params[:payment_type], status: params[:status], q: params[:q], page: params[:page]
    )
  end

  # Reopens one refunded payment so the team can pay again (operators and admins; refunders may only refund).
  def reopen
    authorize!(:reopen, :charges)
    cr = CompletedRequirement.find(params[:id])
    result = Payments::ReopenPayment.call(user: current_user, completed_requirement: cr)
    return render_errors(result.message, status: reopen_status(result.code), code: result.code) unless result.ok

    cr.reload
    render json: { id: cr.id, message: result.message, reopened_at: cr.reopened_at, reopened_by: { name: current_user.fullname } }
  end

  private

  def reopen_status(code)
    code == :in_progress ? :conflict : :unprocessable_entity
  end
end
