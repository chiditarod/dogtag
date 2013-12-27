require 'spec_helper'

describe Team do

  let (:valid_team) { FactoryGirl.create :team }
  let (:some_other_team) { FactoryGirl.create :team, :name => 'some other team' }
  let (:valid_user) { FactoryGirl.create :user }

  describe 'validation' do
    it 'succeeds when all required parameters are present' do
      valid_team.should be_valid
    end

    it 'fails when team name is missing' do
      team = Team.new
      team.valid?.should == false
    end
  end

  describe '#find_by_user' do
    it 'returns teams associated with a user' do
      valid_team.users << valid_user
      Team.find_by_user(valid_user).should == [valid_team]
    end

    it 'returns an empty array when no teams are associated with a user' do
      Team.find_by_user(valid_user).should == []
    end
  end
end
