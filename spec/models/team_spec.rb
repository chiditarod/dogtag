require 'spec_helper'

describe Team do

  describe 'validation' do
    it 'succeeds when all required parameters are present' do
      FactoryGirl.create(:team).should be_valid
    end

    it 'fails when team name is missing' do
      team = Team.new
      team.valid?.should == false
    end
  end
end
