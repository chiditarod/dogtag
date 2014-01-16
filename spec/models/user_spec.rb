require 'spec_helper'

describe User do

  describe '#fullname' do
    before { @user = FactoryGirl.create :user }
    it 'combines the first and last names' do
      expect(@user.fullname).to eq("#{@user.first_name} #{@user.last_name}")
    end
  end
end
