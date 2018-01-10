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

  describe '#allowed_types' do
    it "outputs the ALLOWED_TYPES constant" do
      expect(Requirement.allowed_types).to eq(Requirement::ALLOWED_TYPES)
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

    it 'broadcasts when creating' do
      expect do
        requirement.complete team.id, user
      end.to broadcast(:create_completed_requirement_successful)
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

end
