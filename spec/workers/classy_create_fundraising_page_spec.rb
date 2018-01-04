# Copyright (C) 2017 Devin Breen
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

describe Workers::ClassyCreateFundraisingPage do

  let(:worker) { Workers::ClassyCreateFundraisingPage.new }

  # this stubs out an authenticated classy client
  let(:valid_cc) do
    ENV['CLASSY_CLIENT_ID'] = 'some_id'
    ENV['CLASSY_CLIENT_SECRET'] = 'some_secret'
    valid_auth = {
      'access_token' => 'abc123',
      'token_type' => 'bearer',
      'expires_in' => 3600
    }
    stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(status: 200, body: valid_auth.to_json)
    ClassyClient.new
  end

  describe "#run" do

    before do
      allow(worker).to receive(:log).with("received", any_args)
    end

    context 'when team already has a classy fundraiser page id' do
      let(:team) { FactoryBot.create :team, :with_classy_fundraising_page }
      let(:log) do
        {
          job: {'team_id' => team.id},
          message: "Team id: #{team.id} already has a classy team fundraiser page of #{team.classy_fundraiser_page_id}"
        }
      end

      it 'logs complete and returns' do
        expect(worker).to receive(:log).with("complete", log)
        worker.perform({'team_id' => team.id})
      end
    end

    context 'when team has no classy id' do
      let(:team) { FactoryBot.create :team }
      let(:log) do
        {
          message: "Team id: #{team.id} does not have a classy ID. Set that first"
        }
      end

      it 'logs op-op and returns' do
        expect(worker).to receive(:log).with("no-op", log)
        worker.perform({'team_id' => team.id})
      end
    end

    context 'when user has no classy id' do
      let(:team) { FactoryBot.create :team, :with_classy_id }
      let(:log) do
        {
          message: "User id: #{team.user.id} does not have a classy ID. Set that first"
        }
      end

      it 'logs op-op and returns' do
        expect(worker).to receive(:log).with("no-op", log)
        worker.perform({'team_id' => team.id})
      end
    end

    context 'when classy client errors' do
      let(:race) { FactoryBot.create :race_with_classy_data }
      let(:user) { FactoryBot.create :user, :with_classy_id }
      let(:team) { FactoryBot.create :team, :with_classy_id, race: race, user: user }
      let(:ex)   { StandardError.new("omg") }
      before do
        ENV['CLASSY_CLIENT_ID'] = 'some_id'
        ENV['CLASSY_CLIENT_SECRET'] = 'some_secret'
        stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(status: 400)
      end

      it 'logs the error and re-raises' do
        expect(worker).to receive(:log).with("error", {}, :error, any_args)
        expect do
          worker.perform({'team_id' => team.id})
        end.to raise_error(TransientError)
      end
    end


    context 'when the fundraising page creation is successful' do
      let(:race) { FactoryBot.create :race_with_classy_data }
      let(:user) { FactoryBot.create :user, :with_classy_id }
      let(:team) { FactoryBot.create :team, :with_classy_id, race: race, user: user }
      let(:resp) { File.read("#{Rails.root}/spec/fixtures/classy/create_fundraising_page_response.json") }
      let(:json) { JSON.parse(resp) }

      before do
        expect(ClassyClient).to receive(:new).and_return(valid_cc)
        expect(valid_cc).to receive(:create_fundraising_page).and_return(json)
      end

      it 'saves the id to the team, saves the team, sends confirmation email, logs complete' do
        expect(worker).to receive(:log).with("complete", any_args)
        worker.perform({'team_id' => team.id})
        expect(team.reload.classy_fundraiser_page_id).to eq(json['id'])
      end
    end
  end
end
