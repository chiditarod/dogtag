require "spec_helper"

describe PastRacers do
  let(:user) { FactoryBot.create(:user) }
  let(:current_team) { FactoryBot.create(:team, user: user) }

  def past_team(owner: user)
    FactoryBot.create(:team, user: owner)
  end

  def result
    described_class.new(user: user, team: current_team).call
  end

  it "returns an empty array for a user with no history" do
    expect(result).to eq([])
  end

  it "returns people from teams the user captained, excluding the current team" do
    old_team = past_team
    racer = FactoryBot.create(:person, team: old_team)
    FactoryBot.create(:person, team: current_team)

    expect(result).to eq([racer])
  end

  it "skips legacy racers without an email instead of raising" do
    old_team = past_team
    FactoryBot.create(:person, team: old_team).update_column(:email, nil)
    FactoryBot.create(:person, team: current_team).update_column(:email, nil)
    racer = FactoryBot.create(:person, team: old_team)

    expect(result).to eq([racer])
  end

  it "excludes unknown placeholder emails" do
    old_team = past_team
    FactoryBot.create(:person, team: old_team, email: "Unknown@example.com")
    FactoryBot.create(:person, team: old_team, email: "unknown-racer@example.com")

    expect(result).to eq([])
  end

  it "keeps only the most recently updated record for the same email" do
    older = FactoryBot.create(:person, team: past_team, email: "dup@example.com")
    newer = FactoryBot.create(:person, team: past_team, email: "dup@example.com")
    older.update_columns(updated_at: 2.days.ago)
    newer.update_columns(updated_at: 1.day.ago)

    expect(result).to eq([newer])
  end

  it "excludes people whose email is already on the current team" do
    FactoryBot.create(:person, team: current_team, email: "here@example.com")
    FactoryBot.create(:person, team: past_team, email: "here@example.com")
    kept = FactoryBot.create(:person, team: past_team, email: "gone@example.com")

    expect(result).to eq([kept])
  end

  it "never includes racers from another user's teams" do
    FactoryBot.create(:person, team: past_team(owner: FactoryBot.create(:user)))

    expect(result).to eq([])
  end

  it "orders by most recently updated first" do
    old_team = past_team
    first = FactoryBot.create(:person, team: old_team)
    second = FactoryBot.create(:person, team: old_team)
    first.update_columns(updated_at: 3.days.ago)
    second.update_columns(updated_at: 1.day.ago)

    expect(result).to eq([second, first])
  end
end
