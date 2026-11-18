class CreateTeamBuddies < ActiveRecord::Migration[8.0]
  def change
    create_table :team_buddies do |t|
      t.references :team, null: false, foreign_key: { on_delete: :cascade }
      t.references :buddy_team, null: false, foreign_key: { to_table: :teams, on_delete: :cascade }
      t.timestamps
    end

    add_index :team_buddies, [:team_id, :buddy_team_id], unique: true
    add_column :teams, :other_buddies, :text
  end
end
