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

  describe '#closes_in' do
    it 'returns false if the race is not registerable' do
      closed_race = FactoryGirl.create :race, :name => 'closed race, its today!'
      expect(closed_race.closes_in).to eq(false)
    end

    it 'returns the time between now and registration_close' do
      double(Time.now) { today }
      race = FactoryGirl.create :race, :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      race.closes_in.should == 2.weeks.round
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

  #todo - dry all of these up
  describe '#registerable?' do
    it 'returns true if race is open and not full' do
      double(Time.now) { today }
      race = FactoryGirl.create :race, :name => 'open race 1', :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      race.registerable?.should == true
    end
    it 'returns false if race is closed and not full' do
      closed_race = FactoryGirl.create :race, :name => 'closed race, its today!'
      closed_race.registerable?.should == false
    end
    it 'returns false if race is open and full' do
      double(Time.now) { today }
      full_race = FactoryGirl.create :race, :name => 'open race 1', :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      fill_up full_race
      full_race.registerable?.should == false
    end
    it 'returns false if race is closed and full' do
      closed_full_race = FactoryGirl.create :race, :name => 'closed race, its today!'
      fill_up closed_full_race
      closed_full_race.registerable?.should == false
    end
  end

  describe '#self.find_registerable_races' do
    it 'returns races that are open and registerable' do
      #todo dry this up with the stuff in races_controller_spec.rb
      double(Time.now) { today }
      closed_race = FactoryGirl.create :race, :name => 'closed race, its today!'
      open_race1 = FactoryGirl.create :race, :name => 'open race 1', :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      open_race2 = FactoryGirl.create :race, :name => 'open race 2', :race_datetime => (today + 6.weeks), :registration_open =>(today - 1.week), :registration_close => (today + 1.day)
      full_race = FactoryGirl.create :race, :name => 'full race', :race_datetime => (today + 6.weeks), :registration_open => (today - 1.day), :registration_close => (today + 2.weeks)
      fill_up full_race
      result = Race.find_registerable_races
      result.should == [open_race1, open_race2]
      result.should_not include(closed_race, full_race)

      Race.find_registerable_races.should == [open_race1, open_race2]
      Race.find_registerable_races.should_not include(closed_race, full_race)
    end
  end

  private

  # create enough registrations to max the number available
  def fill_up(race)
    race.max_teams.times do |x|
      race.registrations.create name: "team#{x}", team: Team.create
    end
  end

end
