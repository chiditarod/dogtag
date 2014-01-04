require 'spec_helper'

describe RegistrationRequirement do
  describe 'validations' do

    it 'fails if more than one of the same association is attempted' do
      rr = FactoryGirl.create :registration_requirement
      expect do 
        RegistrationRequirement.create :registration => rr.registration,
          :requirement => rr.requirement, :user => rr.user
      end.to raise_error
    end
  end
end
