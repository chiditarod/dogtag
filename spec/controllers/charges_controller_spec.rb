require 'spec_helper'

describe ChargesController do

  # from http://aspiringwebdev.com/testing-stripe/
  #
  #StripeMock.start
  #customer = Stripe::Customer.create(
  #:email => 'me@me.com',
  #:card => 'valid_card_token'
  #)

  describe '#create' do
    it 'sets @customer if user has customer_id'
    it 'calls stripe & sets @customer to a new customer if user does not have customer_id'

    describe 'fails' do
      it 'when stripe cannot create a customer'
      it 'when stripe cannot perform the charge'
      it 'without required parameters'
      #:stripeToken, :stripeEmail, :amount, :description
    end

    describe 'on success' do
      it 'creates a new CompletedRequirement object'
      it 'saves the customer and charge ids in cr metadata'
      it 'redirects to session[:prior_url]'
      it 'destroys session[:prior_url]'
    end
  end

  describe '#refund' do
    it 'calls stripe refund successfully'
    it 'redirects to prior_url'
    it 'sets refunded on charge object'
    it 'returns 404 if the charge_id cannot be found'
    it 'returns 400 if the charge_id is already refunded'
    it 'destroys the associated completed_requirement'
  end
end
