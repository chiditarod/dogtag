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

describe Tier do

  before { Timecop.freeze(THE_TIME) }
  after  { Timecop.return }

  let!(:req) do
    Timecop.freeze(THE_TIME) do
      FactoryGirl.create :payment_requirement_with_tier
    end
  end

  let(:tier) { req.reload.tiers.first }

  describe 'to_s' do
    let(:tier) { FactoryGirl.build :tier }

    it "displays the price" do
      expect(tier.to_s).to eq(tier.price.to_s)
    end
  end

  describe 'validation' do
    it 'fails when price is not above 0' do
      expect(FactoryGirl.build :tier, :price => -1).to be_invalid
    end

    it 'fails when price is not a number' do
      expect(FactoryGirl.build :tier, :price => 'a').to be_invalid
    end

    it 'fails when another tier has the same "begin_at" value' do
      tier2 = FactoryGirl.build :tier, :price => 6000
      req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'fails when another tier has the same "price" value' do
      tier2 = FactoryGirl.build :tier, :begin_at => (Time.zone.now - 4.weeks)
      req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'passes when two tiers with the same information are assigned to different requirements' do
      req2 = FactoryGirl.create :payment_requirement
      tier2 = FactoryGirl.create(:tier)
      req2.tiers << tier2
      expect(tier2).to be_valid
    end
  end
end
