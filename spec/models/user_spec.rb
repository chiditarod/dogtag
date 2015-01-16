require 'spec_helper'

describe User do

  describe '#deliver_password_reset_instructions!' do
    before { mock_emailer! }
    after  { reset_mailer! }
    let(:user) { FactoryGirl.build(:user) }

    it "changes the user's perishible token" do
      original = user.perishable_token
      user.deliver_password_reset_instructions!('80')
      expect(user.perishable_token).to_not eq(original)
    end

    it "sends an email" do
      user.deliver_password_reset_instructions!('80')
      expect(ActionMailer::Base.deliveries.count).to eq(1)
    end
  end

  describe 'validations' do
    describe 'phone'
    describe 'email'
  end

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
