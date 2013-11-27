require 'spec_helper'

describe Race do
  let (:valid_race) { FactoryGirl.attributes_for :race }

  describe 'validation' do
    it 'succeeds when all required parameters are present' do
      Race.create(valid_race).should be_valid
    end

    it 'fails without valid datetimes' do
      dates = ['race_datetime', 'registration_open', 'registration_close']
      dates.each do |d|
        Race.create(valid_race.merge d => 'abc').should_not be_valid
      end
    end

    it 'fails when registration close and open dates are the same' do
      bad_dates = {'registration_close' => '2013-01-15 00:00:00',
                   'registration_open' => '"2013-01-15 00:00:00'}
      race = Race.new valid_race.merge bad_dates
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before registration_close'
    end

    it 'fails when registration close date is before registration open date' do
      bad_dates = {'registration_close' => '2013-01-15 00:00:00',
                   'registration_open' => '"2013-02-15 00:00:00'}
      race = Race.new valid_race.merge bad_dates
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before registration_close'
    end

    it 'fails when registration open and close dates are not before the race_datetime' do
      bad_dates = {'registration_open' => '2013-04-01 00:00:00',
                   'registration_close' => '"2013-04-15 00:00:00'}
      race = Race.new valid_race.merge bad_dates
      race.should_not be_valid
      race.errors.messages[:registration_open].should include 'must come before race_datetime'
      race.errors.messages[:registration_close].should include 'must come before race_datetime'
    end
  end

  describe '#open?' do
    before do
      @race = Race.create(valid_race)
    end

    it "returns false if today's date is before the open date" do
      Time.should_receive(:now).and_return "2013-01-01 00:00:00"
      @race.open?.should be_false
    end

    it "returns false if today's date is after the close date" do
      Time.should_receive(:now).and_return "2013-02-17 00:00:00"
      @race.open?.should be_false
    end

    it "returns true if today's date is between the open and close dates" do
      Time.should_receive(:now).and_return "2013-02-01 00:00:00"
      @race.open?.should be_true
    end
  end

  describe '#full?' do
    before do
      @race = Race.create(valid_race)
      (@race.max_teams - 1).times { |x| @race.registrations.create name: "team#{x}", team: Team.create }
    end

    it 'returns true if the race is full' do
      @race.registrations.create :name => "team", team: Team.create
      @race.full?.should be_true
    end

    it 'returns false if there are slots available' do
      @race.full?.should be_false
    end
  end



end
