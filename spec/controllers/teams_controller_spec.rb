require 'spec_helper'

describe TeamsController do

  describe '#show' do
    it 'redirects to the race index and sets flash error if a team is not found' do
      get :show, :id => 100
      response.should be_redirect
      flash[:error].should == I18n.translate('team_not_found')
    end

    it 'sets the team object and returns 200' do
      team = FactoryGirl.create :team
      get :show, :id => team.id
      response.status.should == 200
      assigns(:team).should == team
    end
  end



  describe '#create' do

  end

  


  describe "GET 'mush'" do
    it "returns http success" do
      get 'mush'
      response.should be_success
    end
  end

end
