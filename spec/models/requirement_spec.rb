require 'spec_helper'

describe Requirement do

  let (:requirement) { FactoryGirl.create :requirement }
  let (:registration) { FactoryGirl.create :registration, :complete }
  let (:user) { FactoryGirl.create :user }

  describe '#meets_criteria?' do
    it "raises an error since it's an abstract method" do
      expect { requirement.meets_criteria? }.to raise_error
    end
  end

  describe '#complete' do
    before do
      requirement.should_receive(:meets_criteria?).and_return(true)
    end

    it 'returns true if completed requirement record was created' do
      expect(requirement.complete registration, user).to eq(true)
    end

    it 'returns false if the completed requirement record is already present' do
      CompletedRequirement.create :registration => registration,
        :requirement => requirement, :user => user
      expect(requirement.complete registration, user).to eq(false)
    end

    it 'increments the CompletedRequirement table when creating' do
      expect do
        requirement.complete registration, user
      end.to change(CompletedRequirement, :count).by 1
    end
  end

  describe '#completed?' do
    it 'returns false if a requirement is not associated with a particular registration' do
      expect(requirement.completed? registration).to eq(false)
    end

    it 'returns true if a requirement already has an association with a particular registration' do
      CompletedRequirement.create :registration => registration,
        :requirement => requirement, :user => user
      expect(requirement.completed? registration).to eq(true)
    end
  end
end
