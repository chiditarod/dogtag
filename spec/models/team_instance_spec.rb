require 'spec_helper'

describe TeamInstance do

  let (:valid_person) { JSON.parse File.read 'spec/fixtures/valid_person.json' }
  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'name is always present' do
      TeamInstance.create.valid?.should be_false
    end

    it 'name is unique per race' do
      race1 = Race.create(valid_race)
      TeamInstance.create(:name => 'team1', :race => race1)
      TeamInstance.create(:name => 'team1', :race => race1).valid?.should be_false
    end

    it 'name can be the same for different races' do
      race1 = Race.create(valid_race)
      race2 = Race.create(valid_race)
      TeamInstance.create(:name => 'team', :race => race1)
      TeamInstance.create(:name => 'team', :race => race2).valid?.should be_true
    end

    it 'twitter account is unique per race if it is set' do
      race1 = Race.create(valid_race)
      TeamInstance.create(:name => 'team1', :race => race1, :twitter => 'a')
      TeamInstance.create(:name => 'team2', :race => race1, :twitter => 'a').valid?.should be_false
    end

    it 'twitter account can be the same for different races' do
      race1 = Race.create(valid_race)
      race2 = Race.create(valid_race)
      TeamInstance.create(:name => 'team', :race => race1, :twitter => 'a')
      TeamInstance.create(:name => 'team', :race => race2, :twitter => 'a').valid?.should be_true
    end

    it 'not more than people_per team is on a team' do
      race = Race.create(valid_race)
      team = race.team_instances.create(:name => 'team')
      5.times { |x| team.people.create(valid_person) }
      team.valid?.should be_true
      team.people.create(valid_person)
      team.valid?.should be_false
      team.errors.messages[:people_per_team].should == ["People must be less than or equal to max_people_per_team"]
    end
  end

end
