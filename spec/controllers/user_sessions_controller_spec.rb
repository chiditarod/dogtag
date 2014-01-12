require 'spec_helper'

describe UserSessionsController do

  context '[logged out]' do

    before { activate_authlogic }
    let(:user_session_hash) { FactoryGirl.attributes_for :user_session }

    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy
        expect(response).to redirect_to(new_user_session_url)
      end
    end

    describe '#new' do
      it 'returns http success and calls UserSession.new' do
        session_stub = UserSession.new
        UserSession.should_receive(:new).at_least(1).times.and_return session_stub
        get :new
        expect(response).to be_success
      end
    end

    describe '#create' do

      context 'without user_session param' do
        # todo: improve this to check for new_user_session_url w/o a redirect
        it 'renders user_session#new' do
          post :create
          expect(response.status).to eq(200)
        end
      end

      # todo: this still doesn't work (pcorliss?)
      #context 'on successful save of the user_session' do
        #before do
          #FactoryGirl.create :user
          #session[:return_to] = 'http://somewhere'
          #post :create, :user_session => user_session_hash
        #end

        #it 'sets a flash notice' do
          #expect(flash[:notice]).to eq(I18n.t 'login_success')
        #end

        #it 'redirects to value saved in session[:prior_url]' do
          #expect(response).to redirect_to('http://somewhere')
        #end
      #end

      context 'on failure to save the user_session' do
        before do
          session_stub = UserSession.new
          session_stub.should_receive(:valid?).and_return false
          UserSession.should_receive(:new).at_least(1).times.and_return session_stub
          post :create, :user_session => user_session_hash
        end

        it 'sets a flash notice' do
          expect(flash[:error]).to eq(I18n.t 'login_failed')
        end

        # todo: improve this to check for new_user_session_url w/o a redirect
        it 'renders user_session#new' do
          expect(response.status).to eq(200)
        end
      end
    end
  end

  context '[logged in]' do
    before do
      @valid_user = FactoryGirl.create :user
      activate_authlogic
      mock_login! @valid_user
    end

    describe '#destroy' do
      before do
        delete :destroy
      end

      it 'sets flash notice' do
        expect(flash[:notice]).to eq(I18n.t 'logout_success')
      end

      it 'redirects to home' do
        expect(response).to redirect_to(home_url)
      end
    end
  end

end
