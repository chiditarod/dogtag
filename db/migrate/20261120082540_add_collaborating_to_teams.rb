class AddCollaboratingToTeams < ActiveRecord::Migration[8.0]
  def up
    add_column :teams, :collaborating, :boolean

    # Teams that already picked buddies (or wrote some in) said yes; everyone else stays unanswered.
    execute <<~SQL.squish
      UPDATE teams SET collaborating = TRUE
      WHERE EXISTS (SELECT 1 FROM team_buddies WHERE team_buddies.team_id = teams.id)
         OR NULLIF(BTRIM(teams.other_buddies), '') IS NOT NULL
    SQL
  end

  def down
    remove_column :teams, :collaborating
  end
end
