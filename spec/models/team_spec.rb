require 'spec_helper'

describe Team do

  describe 'validation' do
    let (:race) { FactoryGirl.create :race }
    let (:team) { FactoryGirl.create :team }

    context 'succeeds' do
      it 'when all required parameters are present' do
        expect(team).to be_valid
      end

      it 'when a race is open' do
        expect(FactoryGirl.build :team, race: race).to be_valid
      end
    end

    context 'fails' do
      it 'when the same team name registers for a race more than once' do
        expect(FactoryGirl.create :team, name: 'mushfaces', race: race).to be_valid
        expect(FactoryGirl.build :team, name: 'mushfaces', race: race).to be_invalid
      end
    end

    it 'a team can be named the same in different races' do
      race2 = FactoryGirl.create :race
      expect(FactoryGirl.create :team, name: 'mushfaces', race: race).to be_valid
      expect(FactoryGirl.build :team, name: 'mushfaces', race: race2).to be_valid
    end

    it "a team's twitter account (if present) is unique per race" do
      expect(FactoryGirl.create :team, race: race, twitter: '@foo').to be_valid
      expect(FactoryGirl.build :team, race: race, twitter: '@foo').to be_invalid
    end

    it "a team's twitter account can be the same for different races" do
      race2 = FactoryGirl.create :race
      expect(FactoryGirl.create :team, name: 'mushfaces', twitter: '@foo', race: race).to be_valid
      expect(FactoryGirl.create :team, name: 'mushfaces', twitter: '@foo', race: race2).to be_valid
    end

    it "a team's twitter account fails without a leading @" do
      expect(FactoryGirl.build :team, :twitter => 'foo').to be_invalid
    end

    it "a team's twitter account starts with a leading @" do
      expect(FactoryGirl.build :team, :twitter => '@foo').to be_valid
    end
  end

  describe '#export' do
    it 'sets the correct columns'
    it 'returns a multi-dimensional array of teams'
  end

  describe '#needs_people?' do
    let(:race) { FactoryGirl.create :race }
    let(:reg) { FactoryGirl.create :team, :with_people, :race => race, :people_count => (race.people_per_team - 1) }

    it 'returns true if there are less than race.people_per_team people' do
      expect(reg.needs_people?).to be_true
    end

    it 'returns false if there are race.people_per_team people' do
      reg.people << FactoryGirl.create(:person)
      expect(reg.needs_people?).to be_false
    end
  end

  describe '#waitlist_position' do
    it 'returns our position on the waitlist by created_at date'
  end

  describe '#is_full?' do
    it 'should be the opposite of #needs_people?' do
      reg = FactoryGirl.create :team
      reg.stub(:needs_people?).and_return false
      expect(reg.is_full?).to eq(true)
    end
  end

  describe '#finalized?' do
    before do
      @reg = FactoryGirl.create :team
    end

    it "returns true if it doesn't need people, and all requirements are met" do
      @reg.stub(:completed_all_requirements?).and_return true
      @reg.stub(:is_full?).and_return true
      expect(@reg.finalized?).to be_true
    end

    it "returns false if it needs people, and all requirements are met" do
      @reg.stub(:completed_all_requirements?).and_return true
      @reg.stub(:is_full?).and_return false
      expect(@reg.finalized?).to be_false
    end

    it "returns false if it doesn't need people, and all requirements are NOT met" do
      @reg.stub(:completed_all_requirements?).and_return false
      @reg.stub(:is_full?).and_return true
      expect(@reg.finalized?).to be_false
    end

    it "returns false if it needs people, and all requirements are NOT met" do
      @reg.stub(:completed_all_requirements?).and_return false
      @reg.stub(:is_full?).and_return false
      expect(@reg.finalized?).to be_false
    end
  end

  describe '#racer_types_optionlist' do
    it 'returns valid options for select form' do
      r = Team::VALID_RACER_TYPES.map { |t| [t.to_s.humanize, t] }
      expect(Team.racer_types_optionlist).to eq(r)
    end
  end

  describe '#completed_all_requirements?' do
    before do
      @reg = FactoryGirl.create :team
      @race = @reg.race
      req = FactoryGirl.create :enabled_payment_requirement, :race => @race
      FactoryGirl.create :completed_requirement, :requirement => req, :team => @reg
    end

    it 'returns true when a race has no requirements' do
      reg = FactoryGirl.create :team
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
