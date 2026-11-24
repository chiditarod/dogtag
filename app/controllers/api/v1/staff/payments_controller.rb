class Api::V1::Staff::PaymentsController < Api::V1::Staff::BaseController
  def index
    @search = Payments::PaymentSearch.new(
      race_id: params[:race_id], payment_type: params[:payment_type], status: params[:status], q: params[:q], page: params[:page]
    )
  end
end
