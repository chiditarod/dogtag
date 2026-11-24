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
require 'stripe_mock'

describe CompletedRequirement do

  let(:stripe_helper) { StripeMock.create_test_helper }

  describe '#metadata' do
    let (:hash) {{ 'foo' => 'bar' }}
    let (:cr) { FactoryBot.create :completed_requirement }

    it 'returns a hash of JSON data' do
      cr.metadata = JSON.generate hash
      expect(cr.metadata).to eq(hash)
    end

    it 'returns hash of hash data' do
      cr.metadata = hash
      expect(cr.metadata).to eq(hash)
    end

    it 'returns nil if metadata is nil' do
      cr.metadata = nil
      expect(cr.metadata).to be_nil
    end

    it 'returns a hash for legacy rows that were JSON-encoded more than twice' do
      raw = JSON.generate(JSON.generate(JSON.generate(hash)))
      CompletedRequirement.where(id: cr.id).update_all(["metadata = ?", raw])

      expect(CompletedRequirement.find(cr.id).metadata).to eq(hash)
    end
  end

  describe "#payment_status" do
    let(:requirement) { FactoryBot.create(:payment_requirement) }
    let(:team) { FactoryBot.create(:team, race: requirement.race) }

    def payment(attrs = {})
      FactoryBot.create(:completed_requirement, requirement: requirement, team: team, charge_id: "ch_1", **attrs)
    end

    it "is paid for a payment with a charge that has not been refunded" do
      cr = payment
      expect(cr.payment_status).to eq("paid")
      expect(cr).to be_refundable
    end

    it "is refunded once refunded_at is set" do
      cr = payment(refunded_at: Time.current)
      expect(cr.payment_status).to eq("refunded")
      expect(cr).not_to be_refundable
    end

    it "is refunding while a batch item is queued" do
      cr = payment
      FactoryBot.create(:refund_batch_item, completed_requirement: cr)
      expect(cr.payment_status).to eq("refunding")
      expect(cr).not_to be_refundable
    end

    it "is paid again after the batch item has finished without refunding" do
      cr = payment
      FactoryBot.create(:refund_batch_item, completed_requirement: cr, status: "failed")
      expect(cr.payment_status).to eq("paid")
    end

    it "is not_refundable without a charge id" do
      expect(payment(charge_id: nil).payment_status).to eq("not_refundable")
    end

    it "refunded wins over refunding and not_refundable" do
      cr = payment(refunded_at: Time.current, charge_id: nil)
      FactoryBot.create(:refund_batch_item, completed_requirement: cr)
      expect(cr.payment_status).to eq("refunded")
    end

    it "mock payment is not_refundable in production and paid elsewhere" do
      mock = MockPaymentRequirement.create!(name: "Mock fee", race: requirement.race)
      cr = FactoryBot.create(:completed_requirement, requirement: mock, team: team, charge_id: "mock_ch_1")
      expect(cr.payment_status).to eq("paid")

      allow(Rails.env).to receive(:production?).and_return(true)
      expect(cr.payment_status).to eq("not_refundable")
    end

    it "with_payment_status matches #payment_status for every row" do
      other = ->(attrs) { FactoryBot.create(:completed_requirement, requirement: requirement, team: FactoryBot.create(:team, race: requirement.race), **attrs) }
      queued = other.call(charge_id: "ch_q")
      FactoryBot.create(:refund_batch_item, completed_requirement: queued)
      rows = [
        other.call(charge_id: "ch_p"),
        other.call(charge_id: "ch_r", refunded_at: Time.current),
        other.call(charge_id: nil),
        queued
      ]

      %w[paid refunded refunding not_refundable].each do |status|
        expected = rows.select { |cr| cr.payment_status == status }.map(&:id)
        found = CompletedRequirement.joins(:requirement).with_payment_status(status).pluck(:id)
        expect(found).to match_array(expected), "status #{status}"
        expect(expected).not_to be_empty
      end
    end
  end

  describe 'validation' do
    describe 'fails' do
      let (:rr) { FactoryBot.create :completed_requirement }
      it 'when team/requirement pair exists (with same user)' do
        expect(FactoryBot.build :cr, :team => rr.team,
               :requirement => rr.requirement, :user => rr.user)
        .to be_invalid
      end

      it 'when team/requirement pair exists (with different user)' do
        expect(FactoryBot.build :cr, :team => rr.team,
               :requirement => rr.requirement, :user => FactoryBot.create(:user2))
        .to be_invalid
      end
    end
  end

  describe '#delete_by_charge' do

    let!(:cr)  { FactoryBot.create :completed_requirement }
    let(:req)  { cr.requirement }
    let(:team) { cr.team }

    let(:customer) do
      Stripe::Customer.create({
        card: stripe_helper.generate_card_token,
        email: team.user.email,
        metadata: {
        user_id: team.user.id
      }
      })
    end

    let(:charge) do
      Stripe::Charge.create({
        customer:    customer.id,
        amount:      7000,
        currency:    'usd',
        description: 'Registration Fee for Arizona Quints | Chiditarod X',
        metadata: {
          race_name: team.race.name,
          team_name: team.name,
          requirement_id: req.id,
          team_id: team.id
        }
      })
    end

    before { StripeMock.start }
    after  { StripeMock.stop  }

    context 'when the completed requirement is found' do
      it 'is destroyed' do
        expect do
          CompletedRequirement.delete_by_charge(charge)
        end.to change(CompletedRequirement, :count).by -1
      end

      it 'broadcasts when destroying' do
        expect do
          CompletedRequirement.delete_by_charge(charge)
        end.to broadcast(:destroy_completed_requirement_successful)
      end
    end

    context 'when the completed requirement is not found' do

      let(:charge) do
        Stripe::Charge.create({
          customer:    customer.id,
          amount:      7000,
          currency:    'usd',
          description: 'Registration Fee for Arizona Quints | Chiditarod X',
          metadata: {
            race_name: team.race.name,
            team_name: team.name,
            requirement_id: (cr.requirement_id + 1),
            team_id: team.id
          }
        })
      end

      it 'is not destroyed' do
        expect do
          CompletedRequirement.delete_by_charge(charge)
        end.to change(CompletedRequirement, :count).by 0
      end
    end
  end
end
