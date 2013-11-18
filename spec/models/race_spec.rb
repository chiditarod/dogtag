require 'spec_helper'

describe Race do
  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'success with all required parameters' do
      Race.create(valid_race).should be_valid
    end
  end

  describe '#full?' do
    before do
      @race = Race.create(valid_race)
      149.times { |x| @race.registrations.create name: "team#{x}", team: Team.new }
    end

    it 'returns true if the race is full' do
      @race.registrations.create :name => "team150", team: Team.new
      @race.full?.should be_true
    end

    it 'returns false if there are slots available' do
      @race.full?.should be_false
    end
  end

end
