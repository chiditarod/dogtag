require 'spec_helper'

describe Person do

  class << self
    describe '#registered_for_race' do
      it 'returns all the people on finalized teams in a race' do
        reg = FactoryGirl.create :team, :finalized
        expect(Person.registered_for_race reg.race_id).to eq(reg.people)
      end

      it 'does not return people for non-finalized teams in a race' do
        reg = FactoryGirl.create :team, :with_people
        expect(Person.registered_for_race reg.race_id).to eq([])
      end

      it 'filters out all emails with the word "unknown"' do
        reg = FactoryGirl.create :team, :finalized
        person = reg.people.first
        person.email = 'unknown@gmail.com'
        person.save
        expect(Person.registered_for_race(reg.race_id).count).to eq(4)
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

    it 'fails on bad email address' do
      expect(FactoryGirl.build(:person, :email => 'bad@email')).to be_invalid
      expect(FactoryGirl.build(:person, :email => 'bad@email.')).to be_invalid
      expect(FactoryGirl.build(:person, :email => 'bademail.com')).to be_invalid
      expect(FactoryGirl.build(:person, :email => '@bademail.com')).to be_invalid
      expect(FactoryGirl.build(:person, :email => 'bad@email.a')).to be_invalid
    end

    it 'passes when twitter starts with an @ sign' do
      expect(FactoryGirl.build(:person, :twitter => 'bad')).to be_invalid
      expect(FactoryGirl.build(:person, :twitter => '@good')).to be_valid
    end

    it 'fails if associated with a team with race.people_per_team people already assigned' do
      person_hash = FactoryGirl.attributes_for :person
      reg = FactoryGirl.create :team
      reg.race.people_per_team.times { |x| reg.people.create person_hash }
      person = reg.people.new person_hash
      expect(person).to be_invalid
      expect(person.errors.messages[:maximum]).to eq(['people already added to this team'])
    end

  end
end


