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

  describe '#classy_is_ready' do
    let(:team) { FactoryGirl.create(:team) }
    let(:user) { team.user }
    before do
      UserMailer.classy_is_ready(user, team).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq("#{team.race.name}: Fundraising is ready for #{team.name}")
    end
    include_examples "common tests"
  end

  describe '#welcome_email' do
    let(:user) { FactoryGirl.build(:user) }
    before do
      UserMailer.welcome_email(user).deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq('Welcome to dogTag')
    end
    include_examples "common tests"
  end

  describe '#team_finalized_email' do
    let(:team) { FactoryGirl.create(:team) }
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
    let(:team) { FactoryGirl.create(:team) }
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
    let(:user) { FactoryGirl.create(:user) }
    before do
      UserMailer.password_reset_instructions(user, '80').deliver_now
    end

    it 'sets the subject' do
      expect(deliveries.first.subject).to eq('dogTag Password Reset Instructions')
    end
    include_examples "common tests"
  end
end
