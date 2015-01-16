require 'spec_helper'

describe QuestionsController do

  context '[logged out]' do
    shared_examples 'redirects to login' do
      it 'redirects to login' do
        endpoint.call
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    describe '#create' do
      let(:endpoint) { lambda { post :create, team_id: 1 }}
      include_examples 'redirects to login'
    end
    describe '#show' do
      let(:endpoint) { lambda { get :show, id: 1, team_id: 1 }}
      include_examples 'redirects to login'
    end
  end

  describe 'validator' do
    context 'when there are no errors'
      #when no errors, expect []
    context 'when schema does not validate'
      # expect something in array
  end
end
