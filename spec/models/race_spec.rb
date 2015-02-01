require 'spec_helper'

describe Race do
  let(:today) { Time.now.utc }

  describe 'scopes' do
    describe 'past'
    describe 'current'
  end

  describe 'validation' do
    it 'succeeds when all required parameters are present' do
      FactoryGirl.create(:race).should be_valid
    end

    it 'fails without valid datetimes' do
      valid_race_hash = FactoryGirl.attributes_for :race
      dates = [:race_datetime, :registration_open, :registration_close]
      dates.each do |d|
        Race.create(valid_race_hash.merge d => 'abc').should_not be_valid
      end
    end

    it 'fails when registration close and open dates are the same' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today - 1.week), :registration_close => (today - 1.week)
      expect(race).to be_invalid
      expect(race.errors.messages[:registration_open]).to include 'must come before registration_close'
    end

    it 'fails when registration close date is before registration open date' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today - 1.week), :registration_close => (today - 2.weeks)
      expect(race).to be_invalid
      expect(race.errors.messages[:registration_open]).to include 'must come before registration_close'
    end

    it 'fails when registration open and close dates are not before the race_datetime' do
      race = FactoryGirl.build :race, :race_datetime => today,
        :registration_open => (today + 1.week), :registration_close => (today + 2.weeks)
      expect(race).to be_invalid
      expect(race.errors.messages[:registration_open]).to include 'must come before race_datetime'
      expect(race.errors.messages[:registration_close]).to include 'must come before race_datetime'
    end
  end

  describe '#question_fields' do
    context 'when there is no jsonform data' do
      it 'returns empty array'
    end
    context 'when there is jsonform data' do
      it 'returns an unumerable of the json schema keys'
    end
    context 'when json is malformed' do
      it 'returns empty array'
    end
  end

  describe '#filter_field_array' do
    context 'when filter_field is nil' do
      it 'returns empty array'
    end
    context 'when filter_field is blank' do
      it 'returns empty array'
    end
    context 'when filter_field contains comma-separated values' do
      it 'returns array of values'
    end
  end

  describe '#over?' do
    context 'race is in the future' do
      it 'returns false'
    end
    context 'race is right now' do
      it 'returns false'
    end
    context 'race is in the past' do
      it 'returns true'
    end
  end

  describe '#registration_over?' do
    context 'registration close is in the future' do
      it 'returns false'
    end
    context 'registration close is right now' do
      it 'returns true'
    end
    context 'registration close is in the past' do
      it 'returns true'
    end
  end

  describe '#enabled_requirements' do
    before do
      @race = FactoryGirl.create :race
      @req = FactoryGirl.create :enabled_payment_requirement, :race => @race
    end

    it 'returns requirements where enabled? == true' do
      expect(@race.enabled_requirements).to eq [@req]
    end

    it 'does not return disabled requirements' do
      FactoryGirl.create :payment_requirement, :race => @race
      expect(@race.enabled_requirements).to eq [@req]
    end
  end

  describe '#finalized_teams' do
    before do
      @race = FactoryGirl.create :race
      @team = FactoryGirl.create :finalized_team, race: @race
    end

    it 'returns finalized teams' do
      expect(@race.finalized_teams).to eq [@team]
    end

    it 'does not return non-finalized teams' do
      FactoryGirl.create :team, race: @race
      expect(@race.finalized_teams).to eq [@team]
    end
  end

  describe '#open_for_registration?' do
    before do
      @race = FactoryGirl.create :race
    end

    it "returns false if now < registration_open" do
      Time.should_receive(:now).and_return @race.registration_open - 1.day
      expect(@race.open_for_registration?).to eq(false)
    end

    it "returns false if registration_close < now" do
      Time.should_receive(:now).and_return @race.registration_close + 1.day
      expect(@race.open_for_registration?).to eq(false)
    end

    it "returns true if open_for_registration? date < today < close date" do
      Time.should_receive(:now).and_return @race.registration_close - 1.day
      expect(@race.open_for_registration?).to eq(true)
    end
  end

  describe '#days_before_close' do
    it 'returns false if registration_close is in the past' do
      closed_race = FactoryGirl.create :closed_race
      expect(closed_race.days_before_close).to eq(false)
    end

    it 'returns the time between now and registration_close' do
      double(Time.now) { today }
      race = FactoryGirl.create :race, :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
      expect(race.days_before_close).to eq(2.weeks.to_i)
    end
  end

  describe '#full?' do
    before do
      @race = FactoryGirl.create :race
      (@race.max_teams - 1).times do
        FactoryGirl.create :finalized_team, race: @race
      end
    end

    it 'returns false if races has less than the maximum finalized teams' do
      expect(@race.full?).to be_false
    end

    it 'returns false if teams are >= the maximum but some are not finalized' do
      @race.teams << FactoryGirl.create(:team)
      expect(@race.full?).to be_false
      @race.teams << FactoryGirl.create(:team)
      expect(@race.full?).to be_false
    end

    it 'returns true if the race has the maximum finalized teams' do
      FactoryGirl.create :finalized_team, race: @race
      expect(@race.full?).to be_true
    end
  end

  describe '#spots_remaining' do
    before do
      @race = FactoryGirl.create :race
      (@race.max_teams - 1).times do
        FactoryGirl.create :finalized_team, race: @race
      end
    end

    it 'returns the correct number of spots remaining' do
      expect(@race.spots_remaining).to eq 1
    end

    it 'returns 0 if there are no spots remaining' do
      FactoryGirl.create :finalized_team, race: @race
      expect(@race.spots_remaining).to eq 0
    end
  end

  describe '#registerable?' do
    before do
      @race = FactoryGirl.create :race
    end

    it 'returns true if race is open and not full' do
      @race.stub(:open_for_registration?).and_return(true)
      @race.stub(:full?).and_return(false)
      expect(@race.registerable?).to eq(true)
    end

    it 'returns false if race is closed and not full' do
      @race.stub(:open_for_registration?).and_return(false)
      @race.stub(:full?).and_return(false)
      expect(@race.registerable?).to eq(false)
    end

    it 'returns false if race is open and full' do
      @race.stub(:open_for_registration?).and_return(true)
      @race.stub(:full?).and_return(true)
      expect(@race.registerable?).to eq(false)
    end

    it 'returns false if race is closed and full' do
      @race.stub(:open_for_registration?).and_return(false)
      @race.stub(:full?).and_return(true)
    end
  end

  describe '#self.find_registerable_races' do
    it 'returns races where registerable? == true' do
      closed_race = FactoryGirl.create :race
      closed_race.stub(:registerable?).and_return(false)
      open_race = FactoryGirl.create :race
      open_race.stub(:registerable?).and_return(true)
      Race.should_receive(:all).and_return [closed_race, open_race]
      expect(Race.find_registerable_races).to eq([open_race])
    end
  end

  describe '#waitlisted_teams' do
    it 'returns a list of team objects'
    it 'returns them oldest first'
  end

  describe '#self.find_open_races' do
    it "returns races who's registration window is open" do
      closed_race = FactoryGirl.create :race
      closed_race.stub(:open_for_registration?).and_return(false)
      open_race = FactoryGirl.create :race
      open_race.stub(:open_for_registration?).and_return(true)
      Race.should_receive(:all).and_return [closed_race, open_race]
      expect(Race.find_registerable_races).to eq([open_race])
    end
  end

  describe '#waitlist_count' do
    before do
      @race = FactoryGirl.create :race
      (@race.max_teams - 1).times do
        FactoryGirl.create :finalized_team, race: @race
      end
    end

    it 'returns 0 if the race is not full' do
      expect(@race.waitlist_count).to eq(0)
    end

    describe 'when full? == true' do
      before do
        FactoryGirl.create :finalized_team, race: @race
      end

      it 'returns 0 if total teams = finalized_teams' do
        expect(@race.waitlist_count).to eq(0)
      end

      it 'returns the delta between total teams and finalized_teams' do
        FactoryGirl.create :team, race: @race
        expect(@race.waitlist_count).to eq(1)
      end
    end
  end
end
