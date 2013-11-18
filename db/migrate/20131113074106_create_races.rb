class CreateRaces < ActiveRecord::Migration
  def change
    create_table :races do |t|
      t.string :name
      t.datetime :race_datetime
      t.datetime :registration_open
      t.datetime :registration_close
      t.integer :max_teams
      t.integer :people_per_team
      t.timestamps
    end
  end
end
