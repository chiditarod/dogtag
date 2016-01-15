class AddAssignedTeamNumberToTeam < ActiveRecord::Migration
  def up
    add_column :teams, :assigned_team_number, :integer
  end

  def down
    remove_column :teams, :assigned_team_number
  end
end
