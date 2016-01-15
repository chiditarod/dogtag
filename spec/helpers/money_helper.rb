require 'spec_helper'

describe MoneyHelper do

  describe '#price_in_dollars_and_cents' do
    it 'returns an integer of cents as a string of dollars and cents' do
      expect(price_in_dollars_and_cents(10000)).to eq('100.00')
    end

    it 'returns 0.00 when cents is nil' do
      expect(price_in_dollars_and_cents(nil)).to eq('0.00')
    end

    it 'returns 0.00 when cents is 0' do
      expect(price_in_dollars_and_cents(0)).to eq('0.00')
    end
  end
end
