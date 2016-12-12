require 'spec_helper'

describe FlashHelper do

  describe '#flash_to_bootstrap', :type => :helper do
    it 'returns correct bootstrap 3 alert messages' do
      expect(flash_to_bootstrap(:info)).to eq('success')
      expect(flash_to_bootstrap(:notice)).to eq('info')
      expect(flash_to_bootstrap(:error)).to eq('danger')
      expect(flash_to_bootstrap(:alert)).to eq('warning')
    end
  end
end
