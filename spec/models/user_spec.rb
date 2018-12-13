# Copyright (C) 2014 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
require 'spec_helper'

describe User do

  describe 'scopes' do
    let!(:alpha) { FactoryBot.create(:user, last_name: "alpha") }
    let!(:beta)  { FactoryBot.create(:user, last_name: "beta") }
    it "orders by name" do
      expect(User.all.to_a).to eq([alpha, beta])
    end
  end

  describe '#reset_password!' do
    let(:user) { FactoryBot.create(:user) }

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
    describe 'phone' do
      let(:user) { FactoryBot.build(:user) }

      it 'converts phone numbers into the right format' do
        [1111111111, "1111111111"].each do |num|
          user.phone = num
          expect(user).to be_valid
        end
      end

      it 'fails with poorly formed phone number' do
        user.phone = "abc123"
        expect(user).to be_invalid
      end
    end

    describe 'email'
  end

  describe '#gets_admin_menu?' do
    it 'true if user.roles contains :admin' do
      expect(FactoryBot.build(:admin_user).gets_admin_menu?).to be true
    end
    it 'true if user.roles contains :operator' do
      expect(FactoryBot.build(:operator_user).gets_admin_menu?).to be true
    end
    it 'false if normal user' do
      expect(FactoryBot.build(:user).gets_admin_menu?).to be false
    end
  end

  describe '#fullname' do
    before { @user = FactoryBot.create :user }
    it 'combines the first and last names' do
      expect(@user.fullname).to eq("#{@user.first_name} #{@user.last_name}")
    end
  end
end
