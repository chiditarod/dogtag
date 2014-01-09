require 'spec_helper'

describe User do

  describe '#has_teams_for' do
    before do
      @user = FactoryGirl.create :user
      @reg = FactoryGirl.create :registration, :complete
      @reg.team.users << @user
    end

    it 'returns false when a user has no teams' do
      other_user = FactoryGirl.create :user2
      expect(other_user.has_teams_for @reg.race).to eq(false)
    end

    it "returns false if a user's team is already registered for a race" do
      expect(@user.has_teams_for @reg.race).to eq(false)
    end

    it 'returns true if user has a team not registered to a race' do
      @user.teams << FactoryGirl.create(:team)
      expect(@user.has_teams_for @reg.race).to eq(true)
    end

    it "returns true if user's team is not registered to a different race" do
      race = FactoryGirl.create :race
      expect(@user.has_teams_for race).to eq(true)
    end
  end
end
