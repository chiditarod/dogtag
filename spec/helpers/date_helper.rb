require 'spec_helper'

describe DateHelper do
  before do
    date = DateTime.parse "2013-02-15 00:00:00"
  end

  describe '#human_readable', :type => :helper do
    it 'returns human-readable datetime' do
      expect(human_readable datetime).to eq("February 15, 2013 at 12:00 AM")
    end
  end

  describe '#human_readable_small', :type => :helper do
    it 'returns short human-readable datetime' do
      expect(human_readable_short date).to eq("Feb 15, 12:00 AM")
    end
  end

end
