require 'spec_helper'

describe Registration do

  let (:valid_person) { JSON.parse File.read 'spec/fixtures/valid_person.json' }
  let (:valid_race)  { JSON.parse File.read 'spec/fixtures/valid_race.json' }

  describe 'validates' do
    it 'that a team name, team and race are present' do
      race = Race.create(valid_race)
      Registration.new(team: Team.create).should_not be_valid
      Registration.new(race: race).should_not be_valid
      Registration.new(race: race, team: Team.create).should_not be_valid
      Registration.new(name: 'foo').should_not be_valid
      Registration.new(name: 'foo', team: Team.create).should_not be_valid
      Registration.new(name: 'foo', team: Team.create, race: race).should be_valid
    end

    it 'the same team cannot be added to a single race more than once' do
      team = Team.create
      race = Race.create(valid_race)
      Registration.create(:name => 'team1', :team => team, :race => race).should be_valid
      Registration.create(:name => 'team2', :team => team, :race => race).should be_invalid
    end

    it 'no two teams can have the same name in a single race' do
      race = Race.create(valid_race)
      Registration.create(:name => 'team1', :team => Team.create, :race => race).should be_valid
      Registration.create(:name => 'team1', :team => Team.create, :race => race).should be_invalid
    end

    it 'a team can have the same name for different races' do
      team = Team.create
      race1 = Race.create(valid_race)
      race2 = Race.create(valid_race)
      Registration.create(:name => 'team', :team => team, :race => race1).should be_valid
      Registration.create(:name => 'team', :team => team, :race => race2).should be_valid
    end

    it "a team's twitter account is unique per race if it is set" do
      team = Team.create
      race = Race.create(valid_race)
      Registration.create(:name => 'team1', :team => team, :race => race, :twitter => 'a').should be_valid
      Registration.create(:name => 'team2', :team => team, :race => race, :twitter => 'a').should be_invalid
    end

    it "a team's twitter account can be the same for different races" do
      team = Team.create
      race1 = Race.create(valid_race)
      race2 = Race.create(valid_race)
      Registration.create(:name => 'team', :team => team, :race => race1, :twitter => 'a').should be_valid
      Registration.create(:name => 'team', :team => team, :race => race2, :twitter => 'a').should be_valid
    end

    it 'not more than race.people_per team is in a registration' do
      race = Race.create(valid_race)
      reg = Registration.create(:name => 'reg1', :race => race, :team => Team.create)
      reg.should be_valid
      race.people_per_team.times { |x| reg.people.create(valid_person) }
      reg.should be_valid
      reg.people.create(valid_person)
      reg.should be_invalid
      reg.errors.messages[:people_per_team].should == ["People must be less than or equal to max_people_per_team"]
    end

    it 'not more than race.max_teams registrations per race' do
      race = Race.create(valid_race)
      race.max_teams.times do |i|
        Registration.create(:name => "reg#{i}", :race => race, :team => Team.create).should be_valid
      end
      race.reload

      reg = Registration.new :name => "fail", :race => race, :team => Team.create
      reg.should be_invalid
    end
  end

end
