require 'spec_helper'

describe User do

  describe '#reset_password!' do
    let(:user) { FactoryGirl.create(:user) }

    it "changes the user's perishible token" do
      original = user.perishable_token
      user.reset_password!('80')
      expect(user.perishable_token).to_not eq(original)
    end

    it "queues an email to be sent" do
      expect(Workers::PasswordResetEmail).to receive(:perform_async).with({user_id: user.id, host: '80'})
      user.reset_password!('80')
    end
  end

  describe 'validations' do
    describe 'phone'
    describe 'email'
  end

  describe '#gets_admin_menu?' do
    it 'true if user.roles contains :admin' do
      expect(FactoryGirl.build(:admin_user).gets_admin_menu?).to be true
    end
    it 'true if user.roles contains :operator' do
      expect(FactoryGirl.build(:operator_user).gets_admin_menu?).to be true
    end
    it 'false if normal user' do
      expect(FactoryGirl.build(:user).gets_admin_menu?).to be false
    end
  end

  describe '#fullname' do
    before { @user = FactoryGirl.create :user }
    it 'combines the first and last names' do
      expect(@user.fullname).to eq("#{@user.first_name} #{@user.last_name}")
    end
  end
end
