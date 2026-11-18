require "spec_helper"

describe TeamBuddy do
  let(:team) { FactoryBot.create :team }

  it "is valid for two teams in the same race" do
    expect(FactoryBot.build(:team_buddy)).to be_valid
  end

  it "is invalid when the teams are in different races" do
    other = FactoryBot.create :team
    buddy = FactoryBot.build :team_buddy, team: team, buddy_team: other

    expect(buddy).not_to be_valid
    expect(buddy.errors[:buddy_team]).to be_present
  end

  it "is invalid when a team names itself" do
    buddy = FactoryBot.build :team_buddy, team: team, buddy_team: team

    expect(buddy).not_to be_valid
    expect(buddy.errors[:buddy_team]).to be_present
  end

  it "is invalid when the same pair is added twice" do
    existing = FactoryBot.create :team_buddy
    duplicate = FactoryBot.build :team_buddy, team: existing.team, buddy_team: existing.buddy_team

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:buddy_team_id]).to be_present
  end
end
