require 'spec_helper'

describe Tier do

  describe 'validation' do

    before do
      @req = FactoryGirl.create :payment_requirement
      @req.tiers << FactoryGirl.create(:tier)
    end

    it 'fails when another tier has the same "begin_at" value' do
      tier2 = FactoryGirl.build :tier, :price => 60.00
      @req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'fails when another tier has the same "price" value' do
      tier2 = FactoryGirl.build :tier, :price => (Time.now - 4.weeks)
      @req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'passes when two tiers with the same information are assigned to different requirements' do
      req2 = FactoryGirl.create :payment_requirement
      tier2 = FactoryGirl.create(:tier)
      req2.tiers << tier2
      expect(tier2).to be_valid
    end
  end

end
