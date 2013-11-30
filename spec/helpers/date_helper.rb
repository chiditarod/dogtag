require 'spec_helper'

describe DateHelper do

  describe '#human_readable', :type => :helper do
    it 'returns human-readable datetime formatting' do
      datetime = DateTime.parse "2013-02-15 00:00:00"
      nice = human_readable datetime
      nice.should == "February 15, 2013 at 12:00 AM"
    end
  end

end
