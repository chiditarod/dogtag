require 'spec_helper'

describe Race do

  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'success with all required parameters' do
      Race.create(valid_race).valid?.should be_true
    end

    it 'not more than max_teams per race' do
      race = Race.create(valid_race)
      150.times { |x| race.team_instances.create(:name => "team#{x}") }
      race.valid?.should be_true
      race.team_instances.create(:name => 'fail')
      race.valid?.should be_false
    end
  end

end
