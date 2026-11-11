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

  describe "#registration_reminder" do
    let(:race) { FactoryBot.create(:race_with_jsonform, people_per_team: 3) }
    let(:team) { FactoryBot.create(:team, race: race, jsonform: nil) }
    let(:payment) { FactoryBot.create(:payment_requirement_with_tier, race: race) }
    let(:details) { { dedupe_key: "close-24h" } }

    before do
      payment
      FactoryBot.create(:person, team: team)
    end

    it "lists what is missing and links to the team page" do
      mail = UserMailer.registration_reminder(team, "closing_day", details)
      body = mail.body.encoded

      expect(mail.to).to eq([team.user.email])
      expect(mail.subject).to eq("#{race.name}: Registration closes in 24 hours")
      expect(body).to include("1 of 3")
      expect(body).to include("team questions")
      expect(body).to include("registration fee")
      expect(body).to include(RegistrationUi.team_url(team))
    end

    it "omits items that are done" do
      FactoryBot.create_list(:person, 2, team: team)
      team.update!(jsonform: "{}")
      FactoryBot.create(:completed_requirement, team: team, requirement: payment)
      body = UserMailer.registration_reminder(team.reload, "closing_week", details).body.encoded

      expect(body).not_to include("of 3")
      expect(body).not_to include("team questions")
      expect(body).not_to include("registration fee")
    end

    it "includes the new price for tier changes" do
      begins_at = Time.zone.now + 47.hours
      mail = UserMailer.registration_reminder(team, "tier_change", new_price_cents: 7500, begins_at: begins_at, dedupe_key: "tier-1")

      expect(mail.subject).to eq("#{race.name}: Registration price is going up soon")
      expect(mail.body.encoded).to include("$75")
    end

    it "tracks the reminder with its dedupe key" do
      UserMailer.registration_reminder(team, "closing_day", details).deliver_now

      sent = SentEmail.find_by!(team_id: team.id, kind: "registration_reminder")
      expect(sent.dedupe_key).to eq("close-24h")
    end
  end
end
