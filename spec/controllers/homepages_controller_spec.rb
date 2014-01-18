require 'spec_helper'

describe HomepagesController do

  describe '#index' do
    it 'returns http success' do
      expect(response).to be_success
    end
  end
end
