class AddNewTeamToTeams < ActiveRecord::Migration[8.0]
  def up
    # true when the racers' years racing add up to 0, nil until the team has racers.
    add_column :teams, :new_team, :boolean
    # true when an admin set new_team by hand; nil means it follows the roster.
    add_column :teams, :new_team_overridden, :boolean

    # A blank experience counts as 0, the same as Team#refresh_new_team.
    execute <<~SQL
      UPDATE teams
      SET new_team = totals.years = 0
      FROM (
        SELECT team_id, SUM(COALESCE(experience, 0)) AS years
        FROM people
        GROUP BY team_id
      ) AS totals
      WHERE totals.team_id = teams.id
    SQL
  end

  def down
    remove_column :teams, :new_team_overridden
    remove_column :teams, :new_team
  end
end
