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

    def mail_subject(team, details)
      UserMailer.registration_reminder(team, "closing_week", details).subject
    end

    before do
      payment
      FactoryBot.create(:person, team: team)
    end

    it "lists what is missing and links to the team page" do
      mail = UserMailer.registration_reminder(team, "closing_day", details)
      body = mail.body.encoded

      expect(mail.to).to eq([team.user.email])
      expect(mail.subject).to eq("#{race.name}: Registration closes within 24 hours")
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

      expect(mail_subject(team, details)).to eq("#{race.name}: Registration closes #{race.registration_close.in_time_zone("America/Chicago").strftime("%B %-d, %Y at %-l:%M %p %Z")}")
      expect(body).not_to include("of 3")
      expect(body).not_to include("team questions")
      expect(body).not_to include("registration fee")
    end

    it "includes the new price for tier changes" do
      begins_at = Time.zone.now + 47.hours
      mail = UserMailer.registration_reminder(team, "tier_change", new_price_cents: 7500, begins_at: begins_at, dedupe_key: "tier-1")

      expect(mail.subject).to eq("#{race.name}: Registration price changes #{begins_at.in_time_zone("America/Chicago").strftime("%B %-d, %Y at %-l:%M %p %Z")}")
      expect(mail.body.encoded).to include("$75")
    end

    context "with fixed race dates" do
      around { |example| Timecop.travel(Time.utc(2027, 1, 10)) { example.run } }

      let(:race) do
        FactoryBot.create(:race_with_jsonform, people_per_team: 3,
          registration_open: Time.utc(2026, 12, 15, 6), registration_close: Time.utc(2027, 2, 15, 6),
          final_edits_close: Time.utc(2027, 2, 20, 6), race_datetime: Time.utc(2027, 3, 6, 16))
      end

      it "shows a midnight close as 11:59 PM the previous day in the race's zone" do
        mail = UserMailer.registration_reminder(team, "closing_week", details)

        expect(mail.subject).to eq("#{race.name}: Registration closes February 14, 2027 at 11:59 PM CST")
        expect(mail.body.encoded).to include("Registration closes on February 14, 2027 at 11:59 PM CST.")
      end

      it "shows a tier change at its real start, in the race's zone" do
        race.update!(time_zone: "America/Los_Angeles")
        mail = UserMailer.registration_reminder(team, "tier_change", new_price_cents: 7500, begins_at: Time.utc(2027, 1, 1, 8), dedupe_key: "tier-1")

        expect(mail.subject).to eq("#{race.name}: Registration price changes January 1, 2027 at 12:00 AM PST")
      end

      it "shows the close date in the finalized and waitlisted emails using the deadline rule" do
        finalized = UserMailer.team_finalized_email(team.user, team)
        waitlisted = UserMailer.team_waitlisted_email(team.user, team)

        [finalized, waitlisted].each do |mail|
          expect(mail.html_part.body.decoded).to include("February 14, 2027")
          expect(mail.text_part.body.decoded).to include("February 14, 2027")
          expect(mail.text_part.body.decoded).not_to include("February 15, 2027")
        end
      end
    end

    it "tracks the reminder with its dedupe key" do
      UserMailer.registration_reminder(team, "closing_day", details).deliver_now

      sent = SentEmail.find_by!(team_id: team.id, kind: "registration_reminder")
      expect(sent.dedupe_key).to eq("close-24h")
    end

    it "does not expose formatting helpers as mailer actions" do
      expect(UserMailer.action_methods).not_to include("human_readable", "human_readable_short", "price_in_dollars_and_cents")
    end
  end
end
