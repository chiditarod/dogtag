require 'spec_helper'

describe RacesController do

  let (:valid_race_json)  { File.read 'spec/fixtures/valid_race.json' }
  let (:valid_race_hash)  { JSON.parse valid_race_json }

  describe '#show' do
    it 'redirects to the race index and sets flash error if a race is not found' do
      get :show, :id => 100
      response.should be_redirect
      flash[:error].should == I18n.translate('race_not_found')
    end

    it 'sets the race object and returns 200' do
      race = Race.create valid_race_hash
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
      race = Race.create valid_race_hash
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
        bad_payload.delete param.to_s
        post :create, :race => bad_payload
        flash[:error].detect { |val| val.is_a? Hash }.should include param
        response.status.should == 200
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
    it 'returns http success and an array of all races' do
      race1 = Race.create valid_race_hash.merge(:name => 'race1')
      race2 = Race.create valid_race_hash.merge(:name => 'race2')
      race3 = Race.create valid_race_hash.merge(:name => 'race3')
      get :index
      response.should be_success
      expect(assigns(:races)).to eq [race1, race2, race3]
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

end
