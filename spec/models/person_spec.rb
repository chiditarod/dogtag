# Copyright (C) 2013 Devin Breen
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

describe Person do

  describe '#registered_for_race' do
    it 'returns all the people on finalized teams in a race' do
      reg = FactoryGirl.create :finalized_team
      expect(Person.registered_for_race reg.race_id).to eq(reg.people)
    end

    it 'does not return people for non-finalized teams in a race' do
      reg = FactoryGirl.create :team, :with_people
      expect(Person.registered_for_race reg.race_id).to eq([])
    end

    it 'filters out all emails with the word "unknown"' do
      reg = FactoryGirl.create :finalized_team
      person = reg.people.first
      person.email = 'unknown@gmail.com'
      person.save
      expect(Person.registered_for_race(reg.race_id).count).to eq((reg.race.people_per_team - 1))
    end
  end
end

describe 'validation' do
  it 'passes with all required parameters' do
    expect(FactoryGirl.build(:person).valid?).to eq(true)
  end

  it 'fails with invalid years of experience' do
    expect(FactoryGirl.build(:person, :experience => -10)).to be_invalid
  end

  ['bad@email', 'bad@email.', 'bademail.com', '@bademail.com', 'bad@email.a'].each do |email|
    it "fails on bad email address: #{email}" do
      expect(FactoryGirl.build(:person, email: email)).to be_invalid
    end
  end

  it 'passes when twitter starts with an @ sign' do
    expect(FactoryGirl.build(:person, :twitter => 'bad')).to be_invalid
    expect(FactoryGirl.build(:person, :twitter => '@good')).to be_valid
  end

  it 'fails with poorly formed zipcode'
  it 'fails with poorly formed phone number'

  it 'fails if associated with a team with race.people_per_team people already assigned' do
    person_hash = FactoryGirl.attributes_for :person
    reg = FactoryGirl.create :team
    reg.race.people_per_team.times { |x| reg.people.create person_hash }
    person = reg.people.new person_hash
    expect(person).to be_invalid
    expect(person.errors.messages[:maximum]).to eq(['people already added to this team'])
  end
end
