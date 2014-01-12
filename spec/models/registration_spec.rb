require 'spec_helper'

describe Registration do
  let (:race) { FactoryGirl.create :race }
  let (:team) { FactoryGirl.create :team }

  describe 'validation' do
    it 'succeeds when a race is open' do
      expect(FactoryGirl.build :registration, race: race, team: team).to be_valid
    end

    it 'fails when a race is not open' do
      race.stub(:open_for_registration?).and_return false
      expect(FactoryGirl.build :registration, race: race, team: team).to be_invalid
    end

    it 'fails when the same team registers for a single race more than once' do
      expect(FactoryGirl.create :registration, race: race, team: team).to be_valid
      expect(FactoryGirl.build :registration, race: race, team: team).to be_invalid
    end

    it 'no two teams can register the same name in a single race' do
      team2 = FactoryGirl.create :team
      expect(FactoryGirl.create :registration, name: 'mushfaces', race: race, team: team).to be_valid
      expect(FactoryGirl.build :registration, name: 'mushfaces', race: race, team: team2).to be_invalid
    end

    it 'a team can register the same name for different races' do
      race2 = FactoryGirl.create :race
      expect(FactoryGirl.create :registration, name: 'mushfaces', race: race, team: team).to be_valid
      expect(FactoryGirl.build :registration, name: 'mushfaces', race: race2, team: team).to be_valid
    end

    it "a team's twitter account (if present) is unique per race" do
      expect(FactoryGirl.create :registration, race: race, twitter: '@foo').to be_valid
      expect(FactoryGirl.build :registration, race: race, twitter: '@foo').to be_invalid
    end

    it "a team's twitter account can be the same for different races" do
      race2 = FactoryGirl.create :race
      expect(FactoryGirl.create :registration, name: 'mushfaces', twitter: '@foo', race: race, team: team).to be_valid
      expect(FactoryGirl.create :registration, name: 'mushfaces', twitter: '@foo', race: race2, team: team).to be_valid
    end

    it "a team's twitter account fails without a leading @" do
      expect(FactoryGirl.build :registration, :twitter => 'foo').to be_invalid
    end

    it "a team's twitter account starts with a leading @" do
      expect(FactoryGirl.build :registration, :twitter => '@foo').to be_valid
    end

    describe '#needs_people?' do
      before do
        race = FactoryGirl.create :race
        @reg = FactoryGirl.create :registration_with_people, :race => race, :people_count => (race.people_per_team - 1)
      end

      it 'returns true if there are less than race.people_per_team people' do
        expect(@reg.needs_people?).to be_true
      end

      it 'returns false if there are race.people_per_team people' do
        @reg.people << FactoryGirl.create(:person)
        expect(@reg.needs_people?).to be_false
      end
    end

    describe '#is_full?' do
      it 'should be the opposite of #needs_people?' do
        reg = FactoryGirl.create :registration
        reg.stub(:needs_people?).and_return false
        expect(reg.is_full?).to eq(true)
      end
    end

    describe '#finalized?' do
      before do
        @reg = FactoryGirl.create :registration
      end

      it "returns true if it doesn't need people, and all requirements are met" do
        @reg.stub(:completed_all_requirements?).and_return true
        @reg.stub(:is_full?).and_return true
        expect(@reg.finalized?).to eq(true)
      end

      it "returns false if it needs people, and all requirements are met" do
        @reg.stub(:completed_all_requirements?).and_return true
        @reg.stub(:is_full?).and_return false
        expect(@reg.finalized?).to eq(false)
      end

      it "returns false if it doesn't need people, and all requirements are NOT met" do
        @reg.stub(:completed_all_requirements?).and_return false
        @reg.stub(:is_full?).and_return true
        expect(@reg.finalized?).to eq(false)
      end

      it "returns false if it needs people, and all requirements are NOT met" do
        @reg.stub(:completed_all_requirements?).and_return false
        @reg.stub(:is_full?).and_return false
        expect(@reg.finalized?).to eq(false)
      end
    end

    describe '#completed_all_requirements?' do
      before do
        @reg = FactoryGirl.create :registration
        @race = @reg.race
        req = FactoryGirl.create :enabled_payment_requirement, :race => @race
        FactoryGirl.create :completed_requirement, :requirement => req, :registration => @reg
      end

      it 'returns true when a race has no requirements' do
        reg = FactoryGirl.create :registration
        expect(reg.completed_all_requirements?).to eq(true)
      end

      it 'returns true when all enabled requirements are completed' do
        expect(@reg.completed_all_requirements?).to eq(true)
      end

      it 'return false if any enabled requirements are not completed' do
        FactoryGirl.create :enabled_payment_requirement, :race => @race
        expect(@reg.completed_all_requirements?).to eq(false)
      end

      it "ignores a race's requirement when requirement.enabled? == false" do
        FactoryGirl.create :payment_requirement, :race => @race
        expect(@reg.completed_all_requirements?).to eq(true)
      end
    end

  end
end
