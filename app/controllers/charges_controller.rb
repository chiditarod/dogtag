class ChargesController < ApplicationController
  before_filter :require_user

  def create
    @customer = nil
    # lookup existing customer
    if current_user.stripe_customer_id
      StripeHelper.safely_call_stripe do
        @customer = Stripe::Customer.retrieve current_user.stripe_customer_id
      end
    end

    # create new customer
    unless @customer
      StripeHelper.safely_call_stripe do
        @customer = Stripe::Customer.create(
          :card  => params[:stripeToken],
          :email => params[:stripeEmail],
          :metadata => {
            :user_id => current_user.id
          }
        )
      end
    end

    unless @customer
      Rails.logger.error 'Unable to create customer object from Stripe'
      flash[:error] = 'Unable to connect to Stripe at this time. Contact chiditarod@gmail.com ASAP'
      return render :status => 500
    end

    metadata = JSON.parse params[:metadata]

    # save stripe customer_id if needed
    current_user.stripe_customer_id ||= @customer.id
    current_user.save

    # create and perform the charge
    charge = nil
    StripeHelper.safely_call_stripe do
      charge = Stripe::Charge.create(
        :customer    => @customer.id,
        :amount      => params[:amount],
        :description => params[:description],
        :metadata    => metadata,
        :currency    => 'usd'
      )
    end

    # run requirement#complete, which creates a CompletedRequirement
    cr_metadata = {
      'customer_id' => @customer.id,
      'charge_id' => charge.id,
      'amount' => params[:amount]
    }
    req = Requirement.find metadata['requirement_id']
    req.complete metadata['registration_id'], current_user, cr_metadata

    redirect_to session[:prior_url]
    session.delete :prior_url
  end


  def refund
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
      Rails.logger.info "Refund completed for charge: #{@charge.id}"
      return render :status => 500, :error => "Charge was not refunded. No action taken."
    end

    req_id = @charge['metadata']['requirement_id']
    reg_id = @charge['metadata']['registration_id']

    cr = CompletedRequirement.where(:requirement_id => req_id, :registration_id => reg_id).first
    reg = cr.registration
    CompletedRequirement.delete(cr)

    redirect_to race_registration_url(reg.race.id, reg.id)

  rescue Stripe::InvalidRequestError => e
    flash[:error] = e.message
    redirect_to session[:prior_url]
    session.delete :prior_url
  end
end
