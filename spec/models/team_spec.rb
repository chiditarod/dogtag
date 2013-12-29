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

    it 'fails when team name is already taken' do
      expect do
        FactoryGirl.create :team, :name => valid_team.name
      end.to raise_error
    end
  end

end
