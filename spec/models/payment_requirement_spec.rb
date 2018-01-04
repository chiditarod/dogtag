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

describe PaymentRequirement do

  let (:req)   { FactoryBot.create :payment_requirement }
  let (:tier1) { FactoryBot.create :tier }
  let (:tier2) { FactoryBot.create :tier2 }
  let (:tier3) { FactoryBot.create :tier3 }

  before { Timecop.freeze(THE_TIME) }
  after  { Timecop.return }

  describe '#stripe_params' do
    let(:req)  { FactoryBot.create :payment_requirement_with_tier }
    let(:team) { FactoryBot.create :team, race: req.race }

    let(:expected) {{
      description: "#{req.name} for #{team.name} | #{team.race.name}",
      metadata: JSON.generate(
        'race_name' => team.race.name,
        'team_name' => team.name,
        'requirement_id' => req.id,
        'team_id' => team.id
      ),
      amount: req.active_tier.price,
      image: '/images/patch_ring.jpg',
      name: team.race.name
    }}

    it 'creates a hash of data for submission to stripe' do
      expect(req.stripe_params(team)).to eq(expected)
    end
  end

  describe '#enabled?' do
    it 'returns false when no tiers are assigned' do
      expect(req.enabled?).to be false
    end

    it 'returns true when there are tiers' do
      req.tiers << tier1
      expect(req.enabled?).to be true
    end

    it 'return false when all tiers are in the future' do
      req.tiers << tier3
      expect(req.enabled?).to be false
    end
  end

  describe '#next_tier' do
    it 'returns [] if no tiers are defined' do
      expect(req.next_tiers).to be_empty
    end

    it 'returns [] if only 1 tier is defined' do
      req.tiers << tier1
      expect(req.next_tiers).to be_empty
    end

    it 'returns [] if there are no upcoming tiers' do
      req.tiers = [tier1, tier2]
      expect(req.next_tiers).to be_empty
    end
    it 'returns tiers if is a tier in front of the active tier' do
      req.tiers = [tier1, tier2, tier3]
      expect(req.next_tiers).to eq([tier3])
    end
  end

  describe '#active_tier' do

    it 'returns false if no tiers are defined' do
      expect(req.active_tier).to be false
    end

    it 'returns the tier if only 1 tier is defined' do
      req.tiers << tier1
      expect(req.active_tier).to eq(tier1)
    end

    it 'returns correct tier if a former tier has expired' do
      req.tiers = [tier1, tier2]
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns correct tier if there are tiers expired in the past and untriggered tiers in the future' do
      req.tiers = [tier1, tier2, tier3]
      expect(req.active_tier).to eq(tier2)
    end

    it 'returns false if all tiers are in the future' do
      req.tiers << tier3
      expect(req.active_tier).to be false
    end
  end
end
