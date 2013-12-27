require 'spec_helper'

describe UserSessionsController do

  let(:user_session) { FactoryGirl.create :user_session }
  let(:user_session_hash) { FactoryGirl.attributes_for :user_session }

  describe '#new' do
    it 'returns http success and calls UserSession.new' do
      session_stub = UserSession.new
      UserSession.should_receive(:new).at_least(1).times.and_return session_stub
      get :new
      response.should be_success
    end
  end

  describe '#create' do
    it 'saves a new user session and sets flash notice'# do
      #expect do
        #post :create, :user_session => user_session_hash
        #response.status.should == 302
        #flash[:notice].should == 'Logout in successful.'
      #end.to change(UserSession, :count).by 1
    #end

    it 'sets flash and renders new if user session cannot be saved'# do
      #UserSession.should_receive(:new).and_return mock_session
      #mock_session.should_receive(:save).and_return false
      #post :create, :user_session => user_session_hash
      #flash[:error].should == 'Login failed.'
      #response.should redirect_to new_user_session
    #end
  end

  describe '#destroy' do
    it 'destroys the current user session, sets flash, and redirects'
  end

end
