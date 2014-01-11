require 'spec_helper'

describe ChargesController do

  describe '#create' do
    describe 'on success' do

      it 'creates a new CompletedRequirement object'
      it 'redirects to session[:prior_url]'
      it 'destroys session[:prior_url]'
    end
  end

end
