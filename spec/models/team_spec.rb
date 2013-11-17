require 'spec_helper'

describe Team do

  let (:valid_person) { JSON.parse File.read 'spec/fixtures/valid_person.json' }
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

    it 'not more than people_per team is on a team' do
      race = Race.create(valid_race)
      team = race.teams.create(:name => 'team')
      5.times { |x| team.people.create(valid_person) }
      team.valid?.should be_true
      team.people.create(valid_person)
      team.valid?.should be_false
      team.errors.messages[:people_per_team].should == ["People must be less than or equal to max_people_per_team"]
    end
  end

end
