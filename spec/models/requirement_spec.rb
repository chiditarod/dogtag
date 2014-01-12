require 'spec_helper'

describe Requirement do

  let (:requirement) { FactoryGirl.create :requirement }
  let (:registration) { FactoryGirl.create :registration }
  let (:user) { FactoryGirl.create :user }

  describe '#enabled?' do
    it "raises an error since it's an abstract method" do
      expect { requirement.enabled? }.to raise_error
    end
  end

  describe '#complete' do
    it 'returns the completed requirement record after creating it' do
      cr_stub = CompletedRequirement.new(:requirement => requirement, :registration => registration, :user => user)
      CompletedRequirement.should_receive(:new).at_least(:once).and_return cr_stub
      CompletedRequirement.create :registration => registration, :requirement => requirement, :user => user
      expect(requirement.complete registration.id, user).to eq(cr_stub)
    end

    it 'returns false if the completed requirement record is already present' do
      CompletedRequirement.create :registration => registration,
        :requirement => requirement, :user => user
      expect(requirement.complete registration.id, user).to eq(false)
    end

    it 'increments the CompletedRequirement table when creating' do
      expect do
        requirement.complete registration.id, user
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
