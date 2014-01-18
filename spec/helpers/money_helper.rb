require 'spec_helper'

describe MoneyHelper do

  describe '#price_in_dollars_and_cents' do
    it 'returns an integer of cents as a string of dollars and cents' do
      expect(price_in_dollars_and_cents(10000)).to eq('100.00')
    end
  end

end
