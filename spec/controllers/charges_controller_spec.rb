require 'spec_helper'

describe ChargesController do

  describe '#create' do
    describe 'on success' do
      it 'creates a new CompletedRequirement object'
      it 'saves the customer and charge ids in metadata'
      it 'redirects to session[:prior_url]'
      it 'destroys session[:prior_url]'
    end
  end

  describe '#refund' do
    it 'calls stripe refund successfully'
    it 'redirects to prior_url'
    it 'changes charge#refunded to true'
    it 'returns 404 if the charge_id cannot be found'
    it 'returns 400 if the charge_id is already refunded'
    it 'destroys the associated completed_requirement'
  end

end
