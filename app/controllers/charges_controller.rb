class ChargesController < ApplicationController
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

    req = Requirement.find metadata['requirement_id']
    completed = req.complete metadata['registration_id'], current_user

    #redirect_to race_registration_url(:race_id => req.race.id, :id => completed.registration.id)
    redirect_to session[:prior_url]
    session.delete :prior_url

  rescue Stripe::InvalidRequestError => e
  rescue Stripe::CardError => e
    flash[:error] = e.message
    redirect_to session[:prior_url]
    session.delete :prior_url
  end
end
