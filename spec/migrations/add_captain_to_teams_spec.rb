require "spec_helper"
require Rails.root.join("db/migrate/20261120082522_add_captain_to_teams")

describe AddCaptainToTeams do
  let(:race) { FactoryBot.create(:race, people_per_team: 2) }

  def add_racer(team, **attrs)
    FactoryBot.create(:person, team: team, **attrs)
  end

  # Racers added through the model already auto-captain, so start from a blank slate.
  def backfill
    Team.update_all(captain_id: nil, captain_inferred: nil)
    migration = described_class.new
    migration.suppress_messages { migration.backfill_captains }
    Team.reset_column_information
  end

  it "makes the racer who matches the account email the captain, ignoring case" do
    team = FactoryBot.create(:team, race: race)
    add_racer(team)
    mine = add_racer(team, email: "owner@example.com")
    team.user.update_column(:email, "Owner@Example.com")

    backfill

    expect(team.reload.captain_id).to eq(mine.id)
    expect(team.captain_inferred).to be_nil
  end

  it "guesses the lowest-id racer on a finalized team with no email match and flags it" do
    team = FactoryBot.create(:finalized_team, race: race)
    first = team.people.min_by(&:id)

    backfill

    expect(team.reload.captain_id).to eq(first.id)
    expect(team.captain_inferred).to be(true)
  end

  it "prefers the email match over the lowest-id racer on a finalized team" do
    team = FactoryBot.create(:finalized_team, race: race)
    matched = team.people.max_by(&:id)
    team.user.update_column(:email, matched.email)

    backfill

    expect(team.reload.captain_id).to eq(matched.id)
    expect(team.captain_inferred).to be_nil
  end

  it "leaves an unfinalized team with no email match without a captain" do
    team = FactoryBot.create(:team, race: race)
    add_racer(team)

    backfill

    expect(team.reload.captain_id).to be_nil
    expect(team.captain_inferred).to be_nil
  end
end
