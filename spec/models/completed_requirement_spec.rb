require 'spec_helper'

describe CompletedRequirement do

  describe '#metadata' do
    let (:hash) {{ 'foo' => 'bar' }}
    let (:cr) { FactoryGirl.create :completed_requirement }

    it 'returns a hash of JSON data' do
      cr.metadata = JSON.generate hash
      expect(cr.metadata).to eq(hash)
    end

    it 'returns hash of hash data' do
      cr.metadata = hash
      expect(cr.metadata).to eq(hash)
    end

    it 'returns nil if metadata is nil' do
      cr.metadata = nil
      expect(cr.metadata).to be_nil
    end
  end

  describe 'validation' do
    describe 'fails' do
      let (:rr) { FactoryGirl.create :completed_requirement }
      it 'when team/requirement pair exists (with same user)' do
        expect(FactoryGirl.build :cr, :team => rr.team,
               :requirement => rr.requirement, :user => rr.user)
        .to be_invalid
      end

      it 'when team/requirement pair exists (with different user)' do
        expect(FactoryGirl.build :cr, :team => rr.team,
               :requirement => rr.requirement, :user => FactoryGirl.create(:user2))
        .to be_invalid
      end

    end
  end
end
