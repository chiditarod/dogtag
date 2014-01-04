describe PaymentRequirement do


  describe '#active_tier' do
    let (:req) { FactoryGirl.create :payment_requirement }
    let (:tier1) { FactoryGirl.create :tier }
    let (:tier2) { FactoryGirl.create :tier2 }
    let (:tier3) { FactoryGirl.create :tier3 }

    it 'returns the tier if only 1 tier is defined' do
      req.tiers << tier1
      expect(req.active_tier).to eq(tier1)
    end

    it 'returns correct tier if a tier has expired' do
      req.tiers << tier1
      req.tiers << tier2
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns correct tier if there are tiers in the future' do
      req.tiers << tier1
      req.tiers << tier2
      req.tiers << tier3
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns false if no tiers are defined' do
      expect(req.active_tier).to eq(false)
    end

    it 'returns false if all tiers are in the future' do
      req.tiers << tier3
      expect(req.active_tier).to eq(false)
    end
  end

  describe '#fulfilled?' do
    it 'must be implemented' do
      req = PaymentRequirement.new
      expect(req.fulfilled?).to_not raise_error
    end

    #it 'returns true if the user has paid' do
    #end

    #it 'returns false if the user has not paid' do
    #end

    #it 'returns false if no tiers have been added' do
    #end

  end
end
