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
      expect(Workers::PasswordResetEmail).to receive(:perform_async).with({'user_id' => user.id, 'host' => '80'})
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

      it "normalizes formatted input the same way as racers' phones" do
        ["+1 (312) 555-0144", "312.555.0144", "13125550144"].each do |input|
          user.phone = input
          expect(user.phone).to eq("312-555-0144")
        end
      end
    end

    describe 'email' do
      let(:user) { FactoryBot.build(:user) }

      it 'downcases email before validation' do
        user.email = 'TestUser@Example.COM'
        user.valid?
        expect(user.email).to eq('testuser@example.com')
      end

      it 'saves email as lowercase' do
        user.email = 'UPPERCASE@EMAIL.COM'
        user.save!
        expect(user.reload.email).to eq('uppercase@email.com')
      end

      it 'handles mixed case emails' do
        user.email = 'MixedCase@Email.Com'
        user.save!
        expect(user.reload.email).to eq('mixedcase@email.com')
      end

      it 'does not modify already lowercase emails' do
        user.email = 'lowercase@email.com'
        user.save!
        expect(user.reload.email).to eq('lowercase@email.com')
      end

      context 'when email bypasses callback' do
        it 'fails validation if email contains uppercase characters' do
          user.save!
          # Bypass the callback by directly updating the column
          user.update_column(:email, 'Uppercase@Email.Com')
          # Skip callback to test the validation directly
          User.skip_callback(:validation, :before, :downcase_email)
          begin
            user.reload
            expect(user).not_to be_valid
            expect(user.errors[:email]).to include('must be lowercase')
          ensure
            User.set_callback(:validation, :before, :downcase_email)
          end
        end
      end
    end
  end

  describe '#reset_password_from_link' do
    let(:user) { FactoryBot.create(:user) }

    it 'saves a new password and clears a lockout even when another field is now invalid' do
      user.update_columns(phone: nil, failed_login_count: 15)
      expect(user.reset_password_from_link('brandnew123', 'brandnew123')).to be(true)
      user.reload
      expect(user.valid_password?('brandnew123')).to be(true)
      expect(user.failed_login_count).to eq(0)
    end

    it 'reports only password errors and saves nothing' do
      user.update_columns(phone: nil)
      expect(user.reset_password_from_link('short', 'other')).to be(false)
      expect(user.errors.attribute_names).to contain_exactly(:password, :password_confirmation)
      expect(user.reload.valid_password?('12345678')).to be(true)
    end
  end

  describe 'email change notice' do
    let(:user) { FactoryBot.create(:user, email: 'before@example.com') }
    before { user; Workers::EmailChangedEmail.jobs.clear }

    it 'queues a notice to the old address when the email changes' do
      user.update!(email: 'after@example.com')
      expect(Workers::EmailChangedEmail.jobs.map { |job| job['args'].first })
        .to eq([{ 'user_id' => user.id, 'old_email' => 'before@example.com' }])
    end

    it 'queues nothing when other fields change' do
      user.update!(first_name: 'Grace')
      expect(Workers::EmailChangedEmail.jobs).to be_empty
    end
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

  describe '#deletion_blocker' do
    let(:admin) { FactoryBot.create(:admin_user) }

    it 'refuses to delete yourself' do
      expect(admin.deletion_blocker(by: admin)).to eq("You can't delete your own account.")
    end

    it 'names the teams the user owns' do
      owner = FactoryBot.create(:team).user
      expect(owner.deletion_blocker(by: admin)).to eq("Owns 1 team. Delete or reassign them first.")
      FactoryBot.create(:team, user: owner)
      expect(owner.deletion_blocker(by: admin)).to eq("Owns 2 teams. Delete or reassign them first.")
    end

    it 'names the payments of a user with no team' do
      payer = FactoryBot.create(:completed_requirement).user
      expect(payer.deletion_blocker(by: admin)).to eq("Has 1 payment.")
    end

    it 'names refunds made' do
      refunder = FactoryBot.create(:refund_batch).user
      expect(refunder.deletion_blocker(by: admin)).to eq("Made refunds, which are kept as a record.")
    end

    it 'names a single refund made with no batch, since deleting them would blank the record' do
      refunder = FactoryBot.create(:refunder_user)
      FactoryBot.create(:completed_requirement, refunded_by: refunder, refunded_at: Time.current)
      expect(refunder.refund_batches).to be_empty
      expect(refunder.deletion_blocker(by: admin)).to eq("Made refunds, which are kept as a record.")
    end

    it 'is nil for a bare user' do
      expect(FactoryBot.create(:user).deletion_blocker(by: admin)).to be_nil
    end
  end
end
