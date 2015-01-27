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

  context '[logged in]' do

    let (:valid_user) { FactoryGirl.create :admin_user }
    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#show' do
      context 'when race has no jsonform data' do
        let(:race) { FactoryGirl.create :race }
        let(:team) { FactoryGirl.create :team, race: race }
        before do
          get :show, team_id: team.id
        end

        it 'sets flash message' do
          expect(flash[:info]).to eq(I18n.t('questions.none_defined'))
        end
        it 'redirects to team#show' do
          expect(response).to redirect_to(team_path(team))
        end

        it 'should not set @jsonform' do
          expect(assigns(:jsonform)).to be_nil
        end
      end

      context 'when race has jsonform data' do
        let(:race) { FactoryGirl.create :race, :with_jsonform }
        let(:team) { FactoryGirl.create :team, race: race }
        before do
          get :show, team_id: team.id
        end

        it 'renders 200' do
          expect(response.status).to eq(200)
        end

        it 'should not set @jsonform' do
          expect(assigns(:jsonform)).to be_nil
        end
      end
    end

  end

  describe 'validator' do
    context 'when there are no errors'
      #when no errors, expect []
    context 'when schema does not validate'
      # expect something in array
  end
end
