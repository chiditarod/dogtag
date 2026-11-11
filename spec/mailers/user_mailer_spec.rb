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

describe UserMailer do
  let(:deliveries) { ActionMailer::Base.deliveries }

  shared_examples "common tests" do
    it "sends an email" do
      expect(deliveries.count).to eq(1)
    end
    it 'sets sender email' do
      expect(deliveries.first.from).to eq(['dogtag@chiditarod.org'])
    end
    it 'sets reciever email' do
      expect(deliveries.first.to).to eq([user.email])
    end
  end

  describe '#classy_fundraising_team_created' do
    let(:team) { FactoryBot.create(:team) }
    let(:user) { team.user }
    before do
      UserMailer.classy_fundraising_team_created(user, team).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq("#{team.race.name}: Fundraising is ready for #{team.name}")
    end
    include_examples "common tests"
  end

  describe '#welcome_email' do
    let(:user) { FactoryBot.build(:user) }
    before do
      UserMailer.welcome_email(user).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq('Welcome to dogTag')
    end
    include_examples "common tests"
  end

  describe "mailer host" do
    before do
      allow(UserMailer).to receive(:default_url_options).and_return(host: "staging.example.org", protocol: "https")
    end

    it "welcome email links use the configured mailer host" do
      mail = UserMailer.welcome_email(FactoryBot.create(:user))
      expect(mail.body.encoded).to include("staging.example.org")
      expect(mail.body.encoded).not_to include("dogtag.chiditarod.org")
    end

    it "team finalized email links use the configured mailer host" do
      team = FactoryBot.create(:team)
      mail = UserMailer.team_finalized_email(team.user, team)
      expect(mail.body.encoded).to include("staging.example.org")
      expect(mail.body.encoded).not_to include("dogtag.chiditarod.org")
    end
  end

  describe '#team_finalized_email' do
    let(:team) { FactoryBot.create(:team) }
    let(:user) { team.user }
    before do
      UserMailer.team_finalized_email(user, team).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq(team.race.name + ': Registration Confirmed for ' + team.name)
    end
    include_examples "common tests"
  end

  describe '#team_finalized_email' do
    let(:team) { FactoryBot.create(:team) }
    let(:user) { team.user }
    before do
      UserMailer.team_waitlisted_email(user, team).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq(team.race.name + ': Registration Waitlisted for ' + team.name)
    end
    include_examples "common tests"
  end


  describe '#password_reset_instructions' do
    let(:user) { FactoryBot.create(:user) }
    before do
      UserMailer.password_reset_instructions(user, '80').deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq('dogTag Password Reset Instructions')
    end
    include_examples "common tests"
  end
end
