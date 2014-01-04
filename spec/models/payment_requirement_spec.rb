describe PaymentRequirement do

  describe '#active_tier' do
    let (:req) { FactoryGirl.create :payment_requirement }
    let (:tier1) { FactoryGirl.create :tier }
    let (:tier2) { FactoryGirl.create :tier2 }
    let (:tier3) { FactoryGirl.create :tier3 }

    it 'returns false if no tiers are defined' do
      expect(req.active_tier).to eq(false)
    end

    it 'returns the tier if only 1 tier is defined' do
      req.tiers << tier1
      expect(req.active_tier).to eq(tier1)
    end

    it 'returns correct tier if a former tier has expired' do
      req.tiers = [tier1, tier2]
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns correct tier if there are tiers expired in the past and untriggered tiers in the future' do
      req.tiers = [tier1, tier2, tier3]
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns false if all tiers are in the future' do
      req.tiers << tier3
      expect(req.active_tier).to eq(false)
    end
  end

end
