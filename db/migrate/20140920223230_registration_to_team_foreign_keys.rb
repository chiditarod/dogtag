class RegistrationToTeamForeignKeys < ActiveRecord::Migration
  def up
    # completed requirements table
    remove_index  :completed_requirements, :name => :completed_requirements_index
    rename_column :completed_requirements, :registration_id, :team_id
    add_index     :completed_requirements, [:team_id, :requirement_id], :unique => true
    # people table
    rename_column :people, :registration_id, :team_id
  end

  def down
    # completed requirements table
    remove_index  :completed_requirements, [:team_id, :requirement_id]
    rename_column :completed_requirements, :team_id, :registration_id
    add_index :completed_requirements, [:registration_id, :requirement_id],
      :unique => true, :name => 'completed_requirements_index'

    # people table
    rename_column :people, :team_id, :registration_id
  end
end
