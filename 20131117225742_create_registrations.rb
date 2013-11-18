class CreateRegistrations < ActiveRecord::Migration
  def change
    create_table :registrations do |t|
      t.string :name
      t.string :description
      t.string :twitter

      t.belongs_to :team
      t.belongs_to :race
    end

    #add_index :registrations, :team_id, :unique => true
  end
end
