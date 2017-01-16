class ChargesController < ApplicationController
  before_filter :require_user
  before_filter :require_stripe_params, only: [:create]
  before_filter :require_prior_url

  STRIPE_PARAMS = ['amount', 'stripeToken', 'stripeEmail', 'description', 'metadata']

  # TODO: add safely_call_stripe into this method and rip out all the rescue stuff.
  def create
    authorize! :create, :charges

    @customer = Customer.get(current_user, params[:stripeToken], params[:stripeEmail])

    unless @customer
      Rails.logger.error "Unable to create/retrieve customer from Stripe, User ID: #{current_user.id}"
      flash[:error] = I18n.t('charges.unable_to_get_customer')
      url = session.delete(:prior_url)
      return redirect_to(url)
    end

    metadata = JSON.parse params[:metadata]

    charge = Stripe::Charge.create(
      :customer    => @customer.id,
      :amount      => params[:amount],
      :description => params[:description],
      :metadata    => metadata,
      :currency    => 'usd'
    )

    # if we're here, we have a successful charge.
    # create a completed_requirement object and save it.
    # TODO: move away from instance variable
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
    error = StripeHelper.exception_to_hash(e)
    flash[:error] = "Invalid parameters supplied to Stripe API. Please email dogtag@chiditarod.org with this info: #{error[:reason]}"
    log_and_redirect(e)
  rescue Stripe::APIConnectionError => e
    error = StripeHelper.exception_to_hash(e)
    flash[:error] = "There is an issue connecting to the Stripe API: #{error[:reason]}"
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

    success, ex = StripeHelper.safely_call_stripe do
      @charge = Stripe::Charge.retrieve(params[:charge_id])
    end

    return render status: 404, json: {error: ex.message} unless success
    return render status: 400, json: {error: "Charge ID #{@charge.id} is already refunded"} if @charge.refunded

    StripeHelper.safely_call_stripe do
      @charge = @charge.refund
    end

    # TODO: re-evaluate if we want to render 500 here.
    unless @charge.refunded
      str = "Charge ID: #{@charge.id} could not be refunded. No action taken."
      Rails.logger.error(str)
      return render status: 500, json: {error: str}
    end

    req_id = @charge['metadata']['requirement_id']
    # we used to have a registration table that linked a team (to be used more than once) to a race. we later
    # removed the registration table in favor of a single-use team object that registers for a single race.
    # We used to store the registration_id in stripe, and later changed to a team_id but kept support for
    # loading registration_id for older datasets.
    team_id = @charge['metadata']['team_id'] || @charge['metadata']['registration_id']

    # TODO: Do we want to delete the completed requirement, or change its status to
    # indicate it is no longer completed, but keep the object there to show the history?
    # Introduce papertrail on completed requirement to track when the requirement is deleted
    # and by whom.  YES!
    cr = CompletedRequirement.where(:requirement_id => req_id, :team_id => team_id).first
    CompletedRequirement.delete(cr)

    # finally, redirect
    flash[:notice] = "The refund has processed successfully."
    url = session.delete(:prior_url)
    redirect_to url
  end

  private

  def log_and_redirect(e)
    StripeHelper.log_charge_error(e)
    url = session.delete :prior_url
    redirect_to url
  end

  # require that session[:prior_url] exists. this allows this controller's methods
  # to know where to redirect the agent once the method completes.
  def require_prior_url
    unless session[:prior_url]
      render(
        status: 400,
        json: {
          errors: "The calling controller should set session[:prior_url] so this method knows where to return to. e.g. session[:prior_url] = request.original_url"
        }
      )
    end
  end

  def require_stripe_params
    stripe_params = params.slice(*STRIPE_PARAMS)
    if stripe_params.size < STRIPE_PARAMS.size
      missing = STRIPE_PARAMS - stripe_params.keys
      render(
        status: :bad_request,
        json: {
          errors: "Missing required stripe parameter(s): #{missing.join(',')}"
        }
      )
    end
  end
end
