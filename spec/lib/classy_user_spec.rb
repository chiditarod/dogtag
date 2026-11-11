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

describe ClassyUser do

  describe "#link_user_to_classy!" do
    # Issue #162: a returning captain changes their dogtag email to one that is already a
    # classy member and already a supporter of the org, but is missing from the local cache.
    context "when the email is already a classy member and supporter, and the cache has no record" do
      let(:user) { FactoryBot.create :user }
      let(:race) { FactoryBot.create :race, :with_classy_data }
      let(:api) { "#{ClassyClient::API_HOST}/#{ClassyClient::API_VERSION}" }
      let(:json_headers) { { "Content-Type" => "application/json" } }

      before do
        ENV["CLASSY_CLIENT_ID"] = "some_id"
        ENV["CLASSY_CLIENT_SECRET"] = "some_secret"
        stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(
          status: 200, headers: json_headers,
          body: { "access_token" => "123abc", "token_type" => "bearer", "expires_in" => 3600 }.to_json
        )
        stub_request(:get, "#{api}/campaigns/#{race.classy_campaign_id}").to_return(
          status: 200, headers: json_headers, body: { "organization_id" => 99 }.to_json
        )
        stub_request(:post, "#{api}/organizations/99/members").to_return(
          status: 400, headers: json_headers,
          body: { "error" => { "email_address" => ["This email address is already used."] } }.to_json
        )
        stub_request(:post, "#{api}/organizations/99/supporters").to_return(
          status: 400, headers: json_headers,
          body: { "error" => { "member_id" => ["Member 777 is already a supporter for Organization 99"] } }.to_json
        )
      end

      it "looks up the member by email when the cache misses" do
        stub_request(:get, "#{api}/members/#{user.email}").to_return(
          status: 200, headers: json_headers, body: { "id" => 777 }.to_json
        )

        ClassyUser.link_user_to_classy!(user, race)

        expect(user.reload.classy_id).to eq(777)
      end

      it "raises TransientError when the member cannot be found" do
        stub_request(:get, "#{api}/members/#{user.email}").to_return(status: 404)

        expect { ClassyUser.link_user_to_classy!(user, race) }.to raise_error(TransientError)
        expect(user.reload.classy_id).to be_nil
      end
    end

    # let(:user) { FactoryBot.create :user, :with_classy_id }
    # let(:race)   { FactoryBot.create :race }
    # let(:result) { ClassyUser.link_user_to_classy!(user, race) }

    # context "when user is not a classy member" do
    #   let(:user) { FactoryBot.create :user }:with_classy_id }
    #   it "saves the returned classy member id in the user object" do
    #   end
    # end

    # context "when user is a classy member but not an organization supporter" do
    #   # let(:user) { FactoryBot.create :user, :with... }
    #   it "saves the returned classy member id in the user object" do
    #   end
    # end

    # context "when user is a classy member and an organization supporter" do
    #   # let(:user) { FactoryBot.create :user, :with... }
    #   context "when the classy member cache contains the member record" do
    #     it "saves the cached classy member id in the user object" do

    #     end
    #   end

    #   context "when the classy member cache does not contain the member record" do
    #     it "logs an error and does not change the user object" do
    #     end
    #   end
    # end


    # context "when user already has a classy id in local db" do
    #   let(:user) { FactoryBot.create :user, :with_classy_id }
    #   let(:cc)   { double(ClassyClient) }

    #   before do
    #     expect(ClassyClient).to receive(:new).and_return(cc)
    #   end

    #   context "and the classy id associated with the user's email address has changed" do
    #     it "saves the new classy id in the user object" do
    #       expect(user.classy_id).to eq(123456)
    #       expect(cc).to receive(:get_campaign).and_return({'organization_id' => '987'})
    #       expect(cc).to receive(:create_member).with("987", user.first_name, user.last_name, user.email).and_return({'organization_id' => '987'})
    #       expect(cc).to receive(:get_member).and_return({'id' => '123'})
    #       expect(result.classy_id).to eq(123)
    #       expect(user.reload.classy_id).to eq(123)
    #     end
    #   end
    # end

    # context "when user has no classy id" do
    #   let(:user) { FactoryBot.create :user }
    #   let(:cc)   { double(ClassyClient) }

    #   before do
    #     expect(ClassyClient).to receive(:new).and_return(cc)
    #   end

    #   context "user email address has classy account" do
    #     it "associates the user with classy and returns the user object" do
    #       expect(user.classy_id).to be_nil
    #       expect(cc).to receive(:get_member).and_return({'id' => '123'})
    #       expect(result.classy_id).to eq(123)
    #     end
    #   end

    #   context "when email address is not found in classy" do
    #     it "creates a new classy member, associates the user with classy and returns the user object" do
    #       expect(user.classy_id).to be_nil
    #       expect(cc).to receive(:get_member).and_return(nil)
    #       expect(cc).to receive(:get_campaign).and_return({'organization_id' => '123'})
    #       expect(cc).to receive(:create_member).and_return({'id' => '123'})
    #       expect(result.classy_id).to eq(123)
    #     end
    #   end
    # end
  end
end
