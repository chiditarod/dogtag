require 'spec_helper'

describe "TeamAuditor" do

  before do
    team.subscribe(TeamAuditor.new)
  end

  describe ".create_team_successful" do

    let(:race) { FactoryBot.create :race }
    let(:team) { FactoryBot.build :team, race: race }

    context "an unfinalized team is created" do
      it "does not show as finalized" do
        expect(team.finalized?).to be false
        team.save
        expect(team.finalized?).to be false
      end
    end

    context "a finalized team is created" do
      it "shows as finalized" do
        team.race.people_per_team.times do |i|
          team.people << FactoryBot.create(:person)
        end

        expect(team.finalized?).to be false
        team.save
        expect(team.finalized?).to be true
      end
    end
  end

  describe ".update_team_successful" do

    context "an unfinalized team ready to be finalized is updated" do
      let(:team) { FactoryBot.create :team, :with_enough_people }
      it "the team becomes finalized" do
        expect(team.finalized?).to be false
        team.description = "foo"
        team.save
        expect(team.reload.finalized?).to be true
      end
    end

    context "an unfinalized team not ready to be finalized is updated" do
      let(:team) { FactoryBot.create :team, :with_people }

      it "the team does not become finalized" do
        expect(team.finalized?).to be false
        team.description = "foo"
        team.save
        expect(team.reload.finalized?).to be false
      end
    end

    context "a finalized team that still meets all finalization requirements is updated" do
      let(:team) { FactoryBot.create :finalized_team }

      it "the team does not become unfinalized" do
        expect(team.finalized?).to be true
        team.description = "foo"
        team.save
        expect(team.reload.finalized?).to be true
      end
    end

    context "a finalized team that no longer meets all finalization requirements is updated" do
      let(:team) { FactoryBot.create :finalized_team }

      it "the team becomes unfinalized" do
        expect(team.finalized?).to be true
        team.people.first.destroy()
        team.save
        expect(team.reload.finalized?).to be false
      end
    end
  end
end
