class AddCaptainToTeams < ActiveRecord::Migration[8.0]
  def up
    add_reference :teams, :captain, foreign_key: { to_table: :people, on_delete: :nullify }, null: true
    add_column :teams, :captain_inferred, :boolean
    backfill_captains
  end

  def down
    remove_column :teams, :captain_inferred
    remove_reference :teams, :captain, foreign_key: { to_table: :people }
  end

  # Public so the spec can run it against factory data.
  def backfill_captains
    # 1. The racer whose email matches the account that created the team.
    execute <<~SQL
      UPDATE teams
      SET captain_id = match.person_id
      FROM (
        SELECT DISTINCT ON (teams.id) teams.id AS team_id, people.id AS person_id
        FROM teams
        JOIN users ON users.id = teams.user_id
        JOIN people ON people.team_id = teams.id AND LOWER(people.email) = LOWER(users.email)
        ORDER BY teams.id, people.id
      ) AS match
      WHERE teams.id = match.team_id
    SQL

    # 2. Finalized teams still without a captain get their lowest-id racer, flagged as a guess
    # so the export can say so. Unfinalized teams stay blank: their racers are still registering.
    execute <<~SQL
      UPDATE teams
      SET captain_id = first_racer.person_id, captain_inferred = TRUE
      FROM (
        SELECT team_id, MIN(id) AS person_id FROM people GROUP BY team_id
      ) AS first_racer
      WHERE teams.id = first_racer.team_id AND teams.captain_id IS NULL AND teams.finalized IS TRUE
    SQL
  end
end
