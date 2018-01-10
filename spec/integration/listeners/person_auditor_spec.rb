require 'spec_helper'

describe "PersonAuditor" do

  before do
    person.subscribe(PersonAuditor.new)
  end

  context "a person gets created and the team is now full" do
    let(:team) { FactoryBot.create :team, :with_people }
    let(:person) { FactoryBot.build :person, team_id: team.id }

    it "the team becomes finalized" do
      expect(team.finalized?).to be false
      person.save
      expect(team.reload.finalized?).to be true
    end
  end

  context "a person gets created on a team that does not meet all finalization requirements" do
    let(:team) { FactoryBot.create :team }
    let(:person) { FactoryBot.build :person, team_id: team.id }

    it "the team stays unfinalized" do
      expect(team.finalized?).to be false
      person.save
      expect(team.reload.finalized?).to be false
    end
  end

  context "a person on a finalized team gets deleted" do
    let(:team) { FactoryBot.create :finalized_team }
    let(:person) { team.people.first }

    it "the team becomes unfinalized" do
      expect(team.finalized?).to be true
      person.destroy
      expect(team.reload.finalized?).to be false
    end
  end
end
