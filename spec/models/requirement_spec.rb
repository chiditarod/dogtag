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

describe Requirement do

  let (:requirement) { FactoryBot.create :requirement }
  let (:team) { FactoryBot.create :team }
  let (:user) { FactoryBot.create :user }

  describe ".allowed_types" do
    it "offers only real payments in production" do
      allow(Rails.env).to receive(:production?).and_return(true)
      expect(Requirement.allowed_types).to eq([["Payment", "PaymentRequirement"]])
    end

    it "also offers mock payments outside production" do
      expect(Requirement.allowed_types).to include(["Mock payment", "MockPaymentRequirement"])
    end
  end

  describe "type validation" do
    it "rejects a mock requirement in production" do
      allow(Rails.env).to receive(:production?).and_return(true)
      requirement = Requirement.new(name: "Fee", type: "MockPaymentRequirement", race: FactoryBot.create(:race))
      expect(requirement).not_to be_valid
      expect(requirement.errors[:type]).to be_present
    end

    it "rejects a blank type" do
      requirement = Requirement.new(name: "Fee", type: "", race: FactoryBot.create(:race))
      expect(requirement).not_to be_valid
      expect(requirement.errors[:type]).to be_present
    end
  end

  describe '#enabled?' do
    it "raises an error since it's an abstract method" do
      expect { requirement.enabled? }.to raise_error(StandardError)
    end
  end

  describe '#complete' do
    it 'returns the completed requirement record after creating it' do
      cr_stub = CompletedRequirement.new(:requirement => requirement, :team => team, :user => user)
      expect(CompletedRequirement).to receive(:new).at_least(:once).and_return cr_stub
      CompletedRequirement.create :team => team, :requirement => requirement, :user => user
      expect(requirement.complete team.id, user).to eq(cr_stub)
    end

    it 'returns false if the completed requirement record is already present' do
      CompletedRequirement.create :team => team,
        :requirement => requirement, :user => user
      expect(requirement.complete team.id, user).to be false
    end

    it 'increments the CompletedRequirement table when creating' do
      expect do
        requirement.complete team.id, user
      end.to change(CompletedRequirement, :count).by 1
    end

    it "stores charge_id and amount_cents" do
      cr = requirement.complete(team.id, user, "charge_id" => "ch_1", "amount" => 5000)

      expect(cr.charge_id).to eq("ch_1")
      expect(cr.amount_cents).to eq(5000)
      expect(cr.reload.metadata["charge_id"]).to eq("ch_1")
    end

    it "leaves the payment columns blank when there is no charge metadata" do
      cr = requirement.complete(team.id, user)

      expect(cr.charge_id).to be_nil
      expect(cr.amount_cents).to be_nil
    end

    it 'broadcasts when creating' do
      expect do
        requirement.complete team.id, user
      end.to broadcast(:create_completed_requirement_successful)
    end

    context "before the payment columns migration has run (deploy window)" do
      before do
        legacy_columns = CompletedRequirement.column_names - %w[charge_id amount_cents refunded_at stripe_refund_id refunded_by_id]
        allow(CompletedRequirement).to receive(:column_names).and_return(legacy_columns)
      end

      it "still records the payment, with the charge only in the metadata" do
        # Assigning a missing column would raise UnknownAttributeError, so the new columns must not be passed.
        expect(CompletedRequirement).to receive(:new).with(hash_excluding(:charge_id, :amount_cents)).and_call_original
        cr = nil
        expect do
          cr = requirement.complete(team.id, user, "charge_id" => "ch_1", "amount" => 5000)
        end.to change(CompletedRequirement, :count).by(1)

        expect(cr).to be_persisted
        cr.reload
        expect(cr.metadata).to include("charge_id" => "ch_1", "amount" => 5000)
        expect(cr.read_attribute(:charge_id)).to be_nil
        expect(cr.amount_cents).to be_nil
      end
    end
  end

  describe '#completed?' do
    it 'returns false if a requirement is not associated with a particular team' do
      expect(requirement.completed? team).to be false
    end

    it 'returns true if a requirement already has an association with a particular team' do
      CompletedRequirement.create :team => team,
        :requirement => requirement, :user => user
      expect(requirement.completed? team).to be true
    end
  end

  describe '#cr_for' do
    it 'returns nil if a requirement is not associated with a particular team' do
      expect(requirement.cr_for team).to be nil
    end

    it 'returns metadata for a completed_requirement' do
      cr = CompletedRequirement.create :team => team,
        :requirement => requirement, :user => user
      expect(requirement.cr_for team).to eq(cr)
    end
  end

  describe "payment counts and destroy" do
    let(:fee) { FactoryBot.create :payment_requirement_with_tier }

    def pay(refunded_at: nil)
      CompletedRequirement.create!(team: FactoryBot.create(:team), requirement: fee,
        user: FactoryBot.create(:user), refunded_at: refunded_at)
    end

    it "counts paid teams without the refunded ones" do
      pay
      pay(refunded_at: Time.current)

      expect(fee.payments?).to be true
      expect(fee.paid_team_count).to eq(1)
    end

    it "refuses to be destroyed once a team paid, and keeps its prices" do
      pay

      expect(fee.destroy_blocked_reason).to eq("Can't delete: 1 team has paid it.")
      expect(fee.destroy).to be false
      expect(fee.errors[:base]).to eq(["Can't delete: 1 team has paid it."])
      expect(Requirement.exists?(fee.id)).to be true
      expect(Tier.where(requirement_id: fee.id)).to exist
    end

    it "pluralises the count" do
      2.times { pay }

      expect(fee.destroy_blocked_reason).to eq("Can't delete: 2 teams have paid it.")
    end

    it "is still blocked when every payment was refunded" do
      pay(refunded_at: Time.current)

      expect(fee.paid_team_count).to eq(0)
      expect(fee.destroy_blocked_reason).to eq("Can't delete: it has refunded payments.")
      expect(fee.destroy).to be false
      expect(Requirement.exists?(fee.id)).to be true
    end

    it "is destroyed with its prices when nobody paid" do
      expect(fee.payments?).to be false
      expect(fee.destroy_blocked_reason).to be_nil
      expect(fee.destroy).to be_truthy
      expect(Requirement.exists?(fee.id)).to be false
      expect(Tier.where(requirement_id: fee.id)).not_to exist
    end
  end
end
