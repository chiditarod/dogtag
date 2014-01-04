require 'spec_helper'

describe Requirement do
  describe '#fulfilled?' do
    let (:requirement) { FactoryGirl.create :requirement }
    let (:registration) { FactoryGirl.create :registration }
    let (:user) { FactoryGirl.create :user }

    it 'returns false if a requirement is not associated with a particular registration' do
      expect(requirement.fulfilled? registration).to eq(false)
    end

    it 'returns true if a requirement has an association with a particular registration' do
      CompletedRequirement.create :registration => registration,
        :requirement => requirement, :user => user
      expect(requirement.fulfilled? registration).to eq(true)
    end
  end
end
