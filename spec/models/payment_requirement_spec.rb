describe PaymentRequirement do

  describe '#fulfilled?' do
    it 'must be implemented' do
      req = PaymentRequirement.new
      expect(req.fulfilled?).to_not raise_error
    end

    it 'returns true if the user has paid' do

    end

    it 'returns false if the user has not paid' do

    end

    it 'returns false if no tiers have been added' do

    end

  end
end
