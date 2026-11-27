# A refunded payment can be "reopened": the requirement counts as not completed again, so the team can pay
# again. The row is kept (with who and when) so the payment's whole history stays auditable, which means the
# one-row-per-team-and-requirement rule now applies to open rows only.
class AddReopenedToCompletedRequirements < ActiveRecord::Migration[8.0]
  def change
    add_column :completed_requirements, :reopened_at, :datetime
    add_reference :completed_requirements, :reopened_by, foreign_key: { to_table: :users, on_delete: :nullify }, null: true

    remove_index :completed_requirements, [:team_id, :requirement_id], unique: true, name: "index_completed_requirements_on_team_id_and_requirement_id"
    add_index :completed_requirements, [:team_id, :requirement_id], name: "index_completed_requirements_on_team_id_and_requirement_id"
    add_index :completed_requirements, [:team_id, :requirement_id], unique: true, where: "reopened_at IS NULL", name: "index_completed_requirements_one_open_per_team_requirement"
  end
end
