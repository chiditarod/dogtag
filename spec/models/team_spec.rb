require 'spec_helper'

describe Team do

  let (:valid_racer) { JSON.parse File.read 'spec/fixtures/valid_racer.json' }
  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'name is unique' do
      Team.create(:name => 'team1')
      Team.create(:name => 'team1').valid?.should be_false
    end

    it 'name is always present' do
      Team.create.valid?.should be_false
    end

    it 'twitter handle is unique if it is set' do
      Team.create(:name => 'team1', :twitter => 'a')
      Team.create(:name => 'team2', :twitter => 'a').valid?.should be_false
    end

    it 'not more than racers_per team is on a team' do
      race = Race.create(valid_race)
      team = race.teams.create(:name => 'team')
      5.times { |x| team.racers.create(valid_racer) }
      team.valid?.should be_true
      team.racers.create(valid_racer)
      team.valid?.should be_false
      team.errors.messages[:racers_per_team].should == ["Racers must be less than or equal to max_racers_per_team"]
    end
  end

end
