require 'spec_helper'

describe CompletedRequirement do

  describe '#metadata_hash' do
    it 'returns the JSON contents as a hash'
    it 'returns hash contents as a hash'
  end

  describe 'validation' do
    describe 'fails' do
      let (:rr) { FactoryGirl.create :completed_requirement }
      it 'when registration/requirement pair exists (with same user)' do
        CompletedRequirement.create(:registration => rr.registration, :requirement => rr.requirement, :user => rr.user).
          should be_invalid
      end

      it 'when registration/requirement pair exists (with different user)' do
        CompletedRequirement.create(:registration => rr.registration, :requirement => rr.requirement, 
                                    :user => FactoryGirl.create(:user2)).
          should be_invalid
      end
    end
  end

end
