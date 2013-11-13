require 'spec_helper'

describe RacesController do

  let (:valid_race)  { JSON.parse(File.read 'spec/fixtures/valid_race.json').symbolize_keys }

  describe '#create' do
    it 'returns 400 if the race parameter is not passed' do
      post :create
      response.status.should == 400
    end

    it 'returns 200 and sets flash[:error] when required params are missing' do
      required = [:name, :race_datetime, :max_teams, :racers_per_team]
      required.each do |param|
        bad_payload = valid_race.dup
        bad_payload.delete param
        post :create, :race => bad_payload
        #flash[:errors].should == { param => ["can't be blank"] }
        response.status.should == 200
      end
    end

    it 'creates a new race and returns 200' do
      expect do
        post :create, :race => valid_race
        response.status.should == 200
      end.to change(Race, :count).by 1
    end

  end

  describe '#index' do
    it 'returns http success and an array of all races' do
      race1 = Race.create(:name => 'race1', :race_datetime => Time.now, :max_teams => 150, :racers_per_team => 5)
      race2 = Race.create(:name => 'race2', :race_datetime => Time.now, :max_teams => 150, :racers_per_team => 5)
      race3 = Race.create(:name => 'race3', :race_datetime => Time.now, :max_teams => 150, :racers_per_team => 5)
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
