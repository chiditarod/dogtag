require 'spec_helper'

describe Tier do

  before do
    @req = FactoryGirl.create :payment_requirement
    @tier = FactoryGirl.create(:tier)
    @req.tiers << @tier
  end

  describe '#price_in_dollars_and_cents' do
    it 'returns an integer of cents as a string of dollars and cents' do
      expect(@tier.price_in_dollars_and_cents).to eq('50.00')
    end
  end


  describe 'validation' do
    it 'fails when price is not above 0' do
      expect(FactoryGirl.build :tier, :price => -1).to be_invalid
    end

    it 'fails when price is not a number' do
      expect(FactoryGirl.build :tier, :price => 'a').to be_invalid
    end

    it 'fails when another tier has the same "begin_at" value' do
      tier2 = FactoryGirl.build :tier, :price => 6000
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
