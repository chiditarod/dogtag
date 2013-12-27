require 'spec_helper'

describe RacesController do
  let (:valid_race)  { FactoryGirl.create :race }
  let (:valid_race_hash)  { FactoryGirl.attributes_for :race }

  describe '#show' do
    it 'redirects to the race index and sets flash error if a race is not found' do
      get :show, :id => 100
      response.should be_redirect
      flash[:error].should == I18n.translate('race_not_found')
    end

    it 'sets the race object and returns 200' do
      race = FactoryGirl.create :race
      get :show, :id => race.id
      response.status.should == 200
      assigns(:race).should == race
    end
  end

  describe '#update' do
    it 'returns 400 if the race parameter is not valid' do
      put :update, :id => 100
      response.status.should == 400
    end

    it 'updates the race and redirects to the race edit page' do
      race = FactoryGirl.create :race
      get :show, :id => race.id
      patch :update, :id => race.id, :race => {:max_teams => 200}
      response.status.should == 302
      race.reload.max_teams.should == 200
    end
  end

  describe '#create' do
    it 'returns 400 if the race parameter is not passed' do
      post :create
      response.status.should == 400
    end

    it 'returns 200 and sets flash[:error] when required params are missing' do
      required = [:name, :race_datetime, :max_teams, :people_per_team, :registration_open, :registration_close]
      required.each do |param|
        bad_payload = valid_race_hash.dup
        bad_payload.delete param
        post :create, :race => bad_payload
        response.status.should == 200
        flash[:error].should_not be_nil
        flash[:error].detect { |val| val.is_a? Hash }.should include param
      end
    end

    it 'creates a new race and returns 200' do
      expect do
        post :create, :race => valid_race_hash
        response.status.should == 200
      end.to change(Race, :count).by 1
    end

  end

  describe '#index' do
    it 'returns http success and an array of all races open for registration' do
      #todo dry this up with the stuff in race_spec.rb
      today = Time.now
      double(Time.now) { today }
      closed_race = FactoryGirl.create :race, :name => 'closed race, its today!'
      open_race1 = FactoryGirl.create :race, :name => 'open race 1', :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      open_race2 = FactoryGirl.create :race, :name => 'open race 2', :race_datetime => (today + 6.weeks), :registration_open =>(today - 1.week), :registration_close => (today + 1.day)
      get :index
      response.should be_success
      expect(assigns :races).to eq [open_race1, open_race2]
    end
  end

  describe '#new' do
    it 'returns http success and calls Race.new' do
      race_stub = Race.new
      Race.should_receive(:new).and_return race_stub
      get :new
      response.should be_success
    end
  end

  describe '#destroy' do
    it 'returns 400 if the race id is not valid' do
      delete :destroy, :id => 99
      response.status.should == 400
    end

    it 'destroys a race, sets flash, and redirects to races index' do
      dying_race = FactoryGirl.create :race, :name => "Delete Me"
      expect do
        delete :destroy, :id => dying_race.id
        flash[:notice].should == 'Race deleted.'
        response.should redirect_to races_path
      end.to change(Race, :count).by(-1)
    end

    # todo: figure out how to mock the delete failing
    it 'sets flash error and redirects if delete fails'
  end

end
