require 'spec_helper'

describe User do

  describe '#gets_admin_menu?' do
    it 'true if user.roles contains :admin' do
      expect(FactoryGirl.build(:admin_user).gets_admin_menu?).to be_true
    end
    it 'true if user.roles contains :operator' do
      expect(FactoryGirl.build(:operator_user).gets_admin_menu?).to be_true
    end
    it 'false if normal user' do
      expect(FactoryGirl.build(:user).gets_admin_menu?).to be_false
    end
  end

  describe '#fullname' do
    before { @user = FactoryGirl.create :user }
    it 'combines the first and last names' do
      expect(@user.fullname).to eq("#{@user.first_name} #{@user.last_name}")
    end
  end
end
