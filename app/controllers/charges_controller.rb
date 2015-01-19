require 'pry'

class ChargesController < ApplicationController
  before_filter :require_user
  before_filter :require_stripe_params, only: [:create]

  STRIPE_PARAMS = ['amount', 'stripeToken', 'stripeEmail', 'description', 'metadata']

  def create
    authorize! :create, :charges

    user = User.find(current_user.id)
    customer_id = user.stripe_customer_id

    Rails.logger.info "customer id: #{customer_id}"
    @customer = Customer.find_by_customer_id(customer_id)
    @customer ||= Customer.create_new_customer(
      current_user, params[:stripeToken], params[:stripeEmail])

    unless @customer
      Rails.logger.error "Unable to create customer object with Stripe, User ID: #{current_user.id}"
      flash[:error] = I18n.t('charges.unable_to_get_customer')
      url = session.delete(:prior_url)
      return redirect_to(url)
    end

    metadata = JSON.parse params[:metadata]

    begin
      charge = Stripe::Charge.create(
        :customer    => @customer.id,
        :amount      => params[:amount],
        :description => params[:description],
        :metadata    => metadata,
        :currency    => 'usd'
      )
    end

    # if we're here, we have a successful charge.
    # create a completed_requirement object and save it.

    @cr_metadata = {
      'customer_id' => @customer.id,
      'charge_id' => charge.id,
      'amount' => params[:amount]
    }
    req = Requirement.find(metadata['requirement_id'])
    req.complete(metadata['team_id'], current_user, @cr_metadata)

    # finally, redirect
    flash[:notice] = "Your card has been charged successfully."
    url = session.delete(:prior_url)
    redirect_to url

  rescue Stripe::CardError => e
    flash[:error] = e.message
    log_and_redirect(e)
  rescue Stripe::InvalidRequestError => e
    flash[:error] = "An error occured processing your credit card. Please try again."
    log_and_redirect(e)
  rescue Stripe::APIConnectionError => e
    flash[:error] = 'We could not connect to the Stripe API. Please try again.'
    log_and_redirect(e)
  rescue Stripe::StripeError => e
    flash[:error] = 'An error occured connecting to Stripe. Please email dogtag@chiditarod.org.'
    log_and_redirect(e)
  rescue => e
    flash[:error] = 'An error unrelated to processing your credit card has occured. Please email dogtag@chiditarod.org.'
    log_and_redirect(e)
  end

  def refund
    authorize! :refund, :charges

    Rails.logger.info "Refund requested for charge: #{params[:charge_id]}"

    StripeHelper.safely_call_stripe do
      @charge = Stripe::Charge.retrieve(params[:charge_id])
    end

    return render :status => 404, :error => 'Charge not found' unless @charge
    return render :status => 400, :error => 'Already Refunded' if @charge.refunded

    StripeHelper.safely_call_stripe do
      @charge = @charge.refund
    end

    unless @charge.refunded
      str = "Charge ID: #{@charge.id} could not be refunded. No action taken."
      Rails.logger.info str
      return render status: 500, error: str
    end

    req_id = @charge['metadata']['requirement_id']
    # this supports both the old registration_id and the newer team_id
    team_id = @charge['metadata']['team_id'] || @charge['metadata']['registration_id']

    cr = CompletedRequirement.where(:requirement_id => req_id, :team_id => team_id).first
    CompletedRequirement.delete(cr)

    redirect_to team_url(team_id)

  rescue Stripe::InvalidRequestError => e
    flash[:error] = e.message
    redirect_to session[:prior_url]
    session.delete :prior_url
  end

  private

  def log_and_redirect(e)
    StripeHelper.log_charge_error(e)
    url = session.delete :prior_url
    redirect_to url
  end

  def require_stripe_params
    stripe_params = params.slice(*STRIPE_PARAMS)
    if stripe_params.size < STRIPE_PARAMS.size
      missing = STRIPE_PARAMS - stripe_params.keys
      render(
        status: :bad_request,
        json: {
          errors: "Missing required stripe parameter(s): #{missing.join(',')}",
        }
      )
    end
  end
end
