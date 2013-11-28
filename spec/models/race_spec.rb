require 'spec_helper'

describe Race do
  let (:valid_race) { FactoryGirl.attributes_for :race }
  let (:today) { Time.now }

  describe 'validation' do
    it 'succeeds when all required parameters are present' do
      FactoryGirl.create(:race).should be_valid
    end

    it 'fails without valid datetimes' do
      dates = [:race_datetime, :registration_open, :registration_close]
      dates.each do |d|
        Race.create(valid_race.merge d => 'abc').should_not be_valid
      end
    end

    it 'fails when registration close and open dates are the same' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today - 1.week), :registration_close => (today - 1.week)
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before registration_close'
    end

    it 'fails when registration close date is before registration open date' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today - 1.week), :registration_close => (today - 2.weeks)
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before registration_close'
    end

    it 'fails when registration open and close dates are not before the race_datetime' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today + 1.week), :registration_close => (today + 2.weeks)
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before race_datetime'
      race.errors.messages[:registration_close].should include 'must come before race_datetime'
    end
  end

  describe '#open?' do
    before do
      @race = Race.create(valid_race)
    end

    it "returns false if today < open date" do
      Time.should_receive(:now).and_return @race.registration_open - 1.day
      @race.open?.should be_false
    end

    it "returns true if close date < today" do
      Time.should_receive(:now).and_return @race.registration_close + 1.day
      @race.open?.should be_false
    end

    it "returns true if open date < today < close date" do
      Time.should_receive(:now).and_return @race.registration_close - 1.day
      @race.open?.should be_true
    end
  end

  describe '#full?' do
    before do
      @race = FactoryGirl.create :race
      (@race.max_teams - 1).times do |x|
        @race.registrations.create name: "team#{x}", team: Team.create
      end
    end

    it 'returns true if the race is full' do
      @race.registrations.create :name => "team", team: Team.create
      @race.full?.should be_true
    end

    it 'returns false if there are slots available' do
      @race.full?.should be_false
    end
  end

  #describe '#self.find_registerable_races' do
    #it 'returns races that are open and registerable' do
      #today = DateTime.parse "2014-02-01 00:00:00"
      #open_race1 = FactoryGirl.create :race
      #closed_race = FactoryGirl.create :race, :registration_close => (today - 1.week)
      #full_race = FactoryGirl.create :race
       #open_race2 = FactoryGirl.create :race, :registration_close => (today + 1.week)
    #end
  #end

end
