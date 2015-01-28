class AddFinalizedBooleanToTeams < ActiveRecord::Migration
  def up
    add_column :teams, :finalized, :boolean
  end

  def down
    remove_column :teams, :finalized
  end
end
