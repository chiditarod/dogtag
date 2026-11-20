require "spec_helper"
require Rails.root.join("db/migrate/20261120082540_add_collaborating_to_teams")

# Calls only the backfill. Running down/up here would drop and re-add the
# column inside the test transaction, which can reorder `teams` columns and
# break prepared statements in later specs.
describe AddCollaboratingToTeams do
  let(:race) { FactoryBot.create(:race) }
  let!(:picker) { FactoryBot.create(:team, race: race) }
  let!(:writer) { FactoryBot.create(:team, race: race, other_buddies: "The Rolling Pins") }
  let!(:blank_writer) { FactoryBot.create(:team, race: race) }
  let!(:plain) { FactoryBot.create(:team, race: race) }

  it "backfills true for teams with picks or other_buddies and leaves the rest unanswered" do
    picker.team_buddies.create!(buddy_team: plain)
    blank_writer.update_column(:other_buddies, "   ")
    Team.where(id: [picker, writer, blank_writer, plain]).update_all(collaborating: nil)

    migration = described_class.new
    migration.verbose = false
    migration.backfill

    expect(Team.where(id: [picker, writer, blank_writer, plain]).to_h { |t| [t.id, t.collaborating] })
      .to eq(picker.id => true, writer.id => true, blank_writer.id => nil, plain.id => nil)
  end
end
