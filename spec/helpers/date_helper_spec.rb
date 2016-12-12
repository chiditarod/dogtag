require 'spec_helper'

describe DateHelper do
  let(:thedate) { DateTime.parse("2013-02-15 00:00:00") }

  describe '#human_readable', :type => :helper do
    it 'returns human-readable datetime' do
      expect(human_readable(thedate)).to eq("February 15, 2013 at 12:00 AM")
    end
  end

  describe '#human_readable_small', :type => :helper do
    it 'returns short human-readable datetime' do
      expect(human_readable_short(thedate)).to eq("Feb 15, 12:00 AM")
    end
  end
end
