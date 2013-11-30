require 'spec_helper'

describe FlashHelper do

  describe '#flash_to_bootstrap', :type => :helper do
    it 'returns correct bootstrap 3 alert messages' do
      flash_to_bootstrap(:info).should == 'success'
      flash_to_bootstrap(:notice).should == 'info'
      flash_to_bootstrap(:error).should == 'danger'
      flash_to_bootstrap(:alert).should == 'warning'
    end
  end

end
