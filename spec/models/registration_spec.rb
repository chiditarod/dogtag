require 'spec_helper'

describe Registration do
  let (:valid_person_hash) { FactoryGirl.attributes_for :person }
  let (:valid_race) { FactoryGirl.create :race }
  let (:valid_team) { FactoryGirl.create :team }

  describe 'validates' do
    it 'that a team name, team and race are present' do
      Registration.new(team: valid_team).should_not be_valid
      Registration.new(race: valid_race).should_not be_valid
      Registration.new(race: valid_race, team: valid_team).should_not be_valid
      Registration.new(name: 'foo').should_not be_valid
      Registration.new(name: 'foo', team: valid_team).should_not be_valid
      Registration.new(name: 'foo', team: valid_team, race: valid_race).should be_valid
    end

    it 'the same team cannot be registered to the same race more than once' do
      Registration.create(:name => 'team1', :team => valid_team, :race => valid_race).should be_valid
      Registration.create(:name => 'team2', :team => valid_team, :race => valid_race).should be_invalid
    end

    it 'no two teams can register the same name in a single race' do
      team2 = FactoryGirl.create :team, :name => 'some other name'
      Registration.create(:name => 'team1', :race => valid_race, :team => valid_team).should be_valid
      Registration.create(:name => 'team1', :race => valid_race, :team => team2).should be_invalid
    end

    it 'a team can register the same name for different races' do
      race2 = FactoryGirl.create :race, :name => 'some other race'
      Registration.create(:name => 'team', :team => valid_team, :race => valid_race).should be_valid
      Registration.create(:name => 'team', :team => valid_team, :race => race2).should be_valid
    end

    it "a team's twitter account (if present) is unique per race" do
      Registration.create(:name => 'team1', :team => valid_team, :race => valid_race, :twitter => '@foo').should be_valid
      Registration.create(:name => 'team2', :team => valid_team, :race => valid_race, :twitter => '@foo').should be_invalid
    end

    it "a team's twitter account can be the same for different races" do
      race2 = FactoryGirl.create :race, :name => 'some other race'
      Registration.create(:name => 'team', :team => valid_team, :twitter => '@foo', :race => valid_race).should be_valid
      Registration.create(:name => 'team', :team => valid_team, :twitter => '@foo', :race => race2).should be_valid
    end

    it "a team's twitter account fails without a leading @" do
      expect(FactoryGirl.build :registration, :complete, :twitter => 'foo').to be_invalid
    end

    it "a team's twitter account starts with a leading @" do
      expect(FactoryGirl.build :registration, :complete, :twitter => '@foo').to be_valid
    end

    describe '#has_slots?' do
      before do
        @reg = FactoryGirl.create :registration, :complete
        (@reg.race[:people_per_team] - 1).times { |x| @reg.people.create(valid_person_hash) }
      end

      it 'returns true if there are less than race.people_per_team people' do
        expect(@reg.has_slots?).to be_true
      end

      it 'returns false if there are race.people_per_team people' do
        @reg.people.create valid_person_hash
        expect(@reg.has_slots?).to be_false
      end
    end

    it 'not more than race.max_teams registrations per race' do
      valid_race.max_teams.times do |i|
        team = FactoryGirl.create :team, :name => "team#{i}"
        expect(Registration.create :name => "reg#{i}", :race => valid_race, :team => team).to be_valid
      end
      valid_race.reload

      reg = Registration.new :name => "fail", :race => valid_race, :team => Team.create
      expect(reg).to be_invalid
    end
  end

end
