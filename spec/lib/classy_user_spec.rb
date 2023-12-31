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

    let(:race)   { FactoryBot.create :race }
    let(:result) { ClassyUser.link_user_to_classy!(user, race) }

    context "when user already has a classy id in local db" do
      let(:user) { FactoryBot.create :user, :with_classy_id }
      let(:cc)   { double(ClassyClient) }

      before do
        expect(ClassyClient).to receive(:new).and_return(cc)
      end

      context "and the classy id associated with the user's email address has changed" do
        it "saves the new classy id in the user object" do
          expect(user.classy_id).to eq(123456)
          expect(cc).to receive(:get_campaign).and_return({'organization_id' => '987'})
          expect(cc).to receive(:create_member).with("987", user.first_name, user.last_name, user.email).and_return({'organization_id' => '987'})
          expect(cc).to receive(:get_member).and_return({'id' => '123'})
          expect(result.classy_id).to eq(123)
          expect(user.reload.classy_id).to eq(123)
        end
      end
    end

    context "when user has no classy id" do
      let(:user) { FactoryBot.create :user }
      let(:cc)   { double(ClassyClient) }

      before do
        expect(ClassyClient).to receive(:new).and_return(cc)
      end

      context "user email address has classy account" do
        it "associates the user with classy and returns the user object" do
          expect(user.classy_id).to be_nil
          expect(cc).to receive(:get_member).and_return({'id' => '123'})
          expect(result.classy_id).to eq(123)
        end
      end

      context "when email address is not found in classy" do
        it "creates a new classy member, associates the user with classy and returns the user object" do
          expect(user.classy_id).to be_nil
          expect(cc).to receive(:get_member).and_return(nil)
          expect(cc).to receive(:get_campaign).and_return({'organization_id' => '123'})
          expect(cc).to receive(:create_member).and_return({'id' => '123'})
          expect(result.classy_id).to eq(123)
        end
      end
    end
  end
end
