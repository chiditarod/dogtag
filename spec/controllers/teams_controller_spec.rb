require 'spec_helper'

describe TeamsController do

  context '[logged out]' do
    describe '#index' do
      it 'redirects to login' do
        get :index; response.should be_redirect
      end
    end
    describe '#new' do
      it 'redirects to login' do
        get :new; response.should be_redirect
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create; response.should be_redirect
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show, :id => 1; response.should be_redirect
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :id => 1; response.should be_redirect
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :id => 1; response.should be_redirect
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :id => 1; response.should be_redirect
      end
    end
  end

  context '[logged in]' do

    let (:valid_team) { FactoryGirl.create :team }
    let (:valid_user) { FactoryGirl.create :user }

    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#index' do
      it 'sets @teams to teams associated with the current user' do

      end
    end

    describe '#show' do
      it 'redirects to team index and sets flash error if team id is invalid' do
        get :show, :id => 99
        response.should be_redirect
        flash[:error].should == I18n.t('not_found')
      end

      it 'sets the team object and returns 200' do
        get :show, :id => valid_team.id
        response.should be_success
        assigns(:team).should == valid_team
      end
    end

  end

end
