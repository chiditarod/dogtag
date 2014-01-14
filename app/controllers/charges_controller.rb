class ChargesController < ApplicationController
  before_filter :require_user

  def new
  end

  def create
    # todo - validations

    metadata = JSON.parse params[:metadata]

    # create customer
    # todo: use exiting customer if they exist already instead of always creating
    customer = Stripe::Customer.create(
      :card  => params[:stripeToken],
      :email => params[:stripeEmail],
      :metadata => {
        :user_id => current_user.id, :fullname => current_user.fullname
      }
    )

    # create and perform the charge
    charge = Stripe::Charge.create(
      :customer    => customer.id,
      :amount      => params[:amount],
      :description => params[:description],
      :metadata    => metadata,
      :currency    => 'usd'
    )

    # create the completed_requirement object
    data_to_save = {'customer_id' => customer.id, 'charge_id' => charge.id}
    req = Requirement.find metadata['requirement_id']
    req.complete metadata['registration_id'], current_user, data_to_save

    redirect_to session[:prior_url]
    session.delete :prior_url

  # todo more rescue and logic
  rescue Stripe::InvalidRequestError => e
  rescue Stripe::CardError => e
    flash[:error] = e.message
    redirect_to session[:prior_url]
    session.delete :prior_url
  end

  def refund
    Rails.logger.info "refund requested for #{params[:charge_id]}"
    @charge = Stripe::Charge.retrieve(params[:charge_id])

    return render :status => 400, :error => 'Already Refunded' if @charge.refunded

    req_id = @charge['metadata']['requirement_id']
    reg_id = @charge['metadata']['registration_id']
    Rails.logger.error req_id
    Rails.logger.error reg_id

    @charge = @charge.refund
    if @charge.refunded
      cr = CompletedRequirement.where(:requirement_id => req_id, :registration_id => reg_id).first
      reg = cr.registration
      CompletedRequirement.delete(cr)
    end

    redirect_to race_registration_url(reg.race.id, reg.id)

  rescue Stripe::InvalidRequestError => e
    flash[:error] = e.message
    redirect_to session[:prior_url]
    session.delete :prior_url
  end

end
