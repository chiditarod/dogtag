require 'spec_helper'

describe Registration do
  let (:valid_person_hash) { FactoryGirl.attributes_for :person }
  let (:valid_race)   { FactoryGirl.create :race }
  let (:valid_team)   { FactoryGirl.create :team }

  describe 'validates' do
    it 'that a team name, team and race are present' do
      Registration.new(team: valid_team).should_not be_valid
      Registration.new(race: valid_race).should_not be_valid
      Registration.new(race: valid_race, team: valid_team).should_not be_valid
      Registration.new(name: 'foo').should_not be_valid
      Registration.new(name: 'foo', team: valid_team).should_not be_valid
      Registration.new(name: 'foo', team: valid_team, race: valid_race).should be_valid
    end

    it 'the same team cannot be added to a single race more than once' do
      Registration.create(:name => 'team1', :team => valid_team, :race => valid_race).should be_valid
      Registration.create(:name => 'team2', :team => valid_team, :race => valid_race).should be_invalid
    end

    it 'no two teams can have the same name in a single race' do
      team2 = FactoryGirl.create :team, :name => 'some other name'
      Registration.create(:name => 'team1', :race => valid_race, :team => valid_team).should be_valid
      Registration.create(:name => 'team1', :race => valid_race, :team => team2).should be_invalid
    end

    it 'a team can have the same name for different races' do
      race2 = FactoryGirl.create :race, :name => 'some other race'
      Registration.create(:name => 'team', :team => valid_team, :race => valid_race).should be_valid
      Registration.create(:name => 'team', :team => valid_team, :race => race2).should be_valid
    end

    it "a team's twitter account is unique per race if it is set" do
      Registration.create(:name => 'team1', :team => valid_team, :race => valid_race, :twitter => 'a').should be_valid
      Registration.create(:name => 'team2', :team => valid_team, :race => valid_race, :twitter => 'a').should be_invalid
    end

    it "a team's twitter account can be the same for different races" do
      race2 = FactoryGirl.create :race, :name => 'some other race'
      Registration.create(:name => 'team', :team => valid_team, :twitter => 'a', :race => valid_race).should be_valid
      Registration.create(:name => 'team', :team => valid_team, :twitter => 'a', :race => race2).should be_valid
    end

    it 'not more than race.people_per team is in a registration' do
      reg = Registration.create(:name => 'reg1', :race => valid_race, :team => Team.create)
      reg.should be_valid
      valid_race.people_per_team.times { |x| reg.people.create(valid_person_hash) }
      reg.should be_valid
      reg.people.create valid_person_hash
      reg.should be_invalid
      reg.errors.messages[:people_per_team].should == ["People must be less than or equal to max_people_per_team"]
    end

    it 'not more than race.max_teams registrations per race' do
      valid_race.max_teams.times do |i|
        team = FactoryGirl.create :team, :name => "team#{i}"
        Registration.create(:name => "reg#{i}", :race => valid_race, :team => team).should be_valid
      end
      valid_race.reload

      reg = Registration.new :name => "fail", :race => valid_race, :team => Team.create
      reg.should be_invalid
    end
  end

end
