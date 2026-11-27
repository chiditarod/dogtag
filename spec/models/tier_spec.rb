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

  let!(:req) do
    FactoryBot.create :payment_requirement_with_tier
  end

  let(:tier) { req.reload.tiers.first }

  describe 'to_s' do
    let(:tier) { FactoryBot.build :tier }

    it "displays the price" do
      expect(tier.to_s).to eq(tier.price.to_s)
    end
  end

  describe 'validation' do
    it 'fails when price is not above 0' do
      expect(FactoryBot.build :tier, :price => -1).to be_invalid
    end

    it 'fails when price is not a number' do
      expect(FactoryBot.build :tier, :price => 'a').to be_invalid
    end

    it 'fails when another tier has the same "begin_at" value' do
      tier2 = FactoryBot.build :tier, price: 6000, begin_at: tier.begin_at
      req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'fails when another tier has the same "price" value' do
      tier2 = FactoryBot.build :tier, :begin_at => (Time.zone.now - 4.weeks)
      req.tiers << tier2
      expect(tier2).to be_invalid
    end

    it 'says which price or start is already used on the fee' do
      same_price = FactoryBot.build :tier, requirement: req, price: tier.price, begin_at: 1.week.ago
      same_begin = FactoryBot.build :tier, requirement: req, price: 9900, begin_at: tier.begin_at

      expect(same_price).to be_invalid
      expect(same_price.errors[:price]).to eq(["is already used by another price on this fee"])
      expect(same_begin).to be_invalid
      expect(same_begin.errors[:begin_at]).to eq(["is already used by another price on this fee"])
    end

    it 'requires a start' do
      no_start = FactoryBot.build :tier, requirement: req, price: 9900, begin_at: nil

      expect(no_start).to be_invalid
      expect(no_start.errors[:begin_at]).to eq(["can't be blank"])
    end

    it 'passes when two tiers with the same information are assigned to different requirements' do
      req2 = FactoryBot.create :payment_requirement_with_tier
      expect(req2.tiers.first).to be_valid
    end
  end

  describe 'destroy' do
    def pay(requirement, refunded_at: nil)
      CompletedRequirement.create!(team: FactoryBot.create(:team), requirement: requirement,
        user: FactoryBot.create(:user), refunded_at: refunded_at)
    end

    it 'refuses the only price of a fee teams have paid' do
      pay(req)

      expect(tier.destroy_blocked_reason).to eq("Can't delete the only price of a fee teams have paid.")
      expect(tier.destroy).to be false
      expect(tier.errors[:base]).to eq(["Can't delete the only price of a fee teams have paid."])
      expect(Tier.exists?(tier.id)).to be true
    end

    it 'refuses it when the only payment was refunded' do
      pay(req, refunded_at: Time.current)

      expect(tier.destroy).to be false
      expect(Tier.exists?(tier.id)).to be true
    end

    it 'destroys one of two prices of a paid fee' do
      pay(req)
      FactoryBot.create :tier2, requirement: req

      expect(tier.destroy_blocked_reason).to be_nil
      expect(tier.destroy).to be_truthy
      expect(Tier.exists?(tier.id)).to be false
    end

    it 'ignores a legacy price without a start when counting a paid fee\'s prices' do
      pay(req)
      undated = Tier.new(requirement: req, price: 1234, begin_at: nil)
      undated.save(validate: false)

      expect(tier.destroy_blocked_reason).to eq("Can't delete the only price of a fee teams have paid.")
      expect(tier.destroy).to be false
      expect(undated.destroy_blocked_reason).to be_nil
      expect(undated.destroy).to be_truthy
    end

    it 'destroys the only price of an unpaid fee' do
      expect(tier.destroy).to be_truthy
      expect(Tier.exists?(tier.id)).to be false
    end
  end

  describe 'a legacy tier without a start' do
    it 'never applies and never raises in the fee' do
      dated = tier
      undated = Tier.new(requirement: req, price: 1234, begin_at: nil)
      undated.save(validate: false)
      fresh = PaymentRequirement.find(req.id)

      expect(fresh.active_tier).to eq(dated)
      expect(fresh.next_tiers).to eq([])
    end
  end
end
