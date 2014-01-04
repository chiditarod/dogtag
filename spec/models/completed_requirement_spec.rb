require 'spec_helper'

describe CompletedRequirement do

  describe 'validations' do
    it 'fails to create a duplicate association between registration and requirement' do
      rr = FactoryGirl.create :completed_requirement
      expect do 
        CompletedRequirement.create :registration => rr.registration,
          :requirement => rr.requirement, :user => FactoryGirl.create(:user2)
      end.to raise_error
    end
  end

end
