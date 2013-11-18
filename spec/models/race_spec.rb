require 'spec_helper'

describe Race do
  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'success with all required parameters' do
      Race.create(valid_race).should be_valid
    end

    it 'ensures the registration close date is after the registration open date' do

    end
  end

  describe '#open?' do
    it "returns false if today's date is before the open date" do

    end

    it "returns false if today's date is after the close date" do

    end

    it "returns true if today's date is between the open and close dates" do
      race = Race.create(valid_race)
      race.should be_valid
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
