class CreateRacesAndTeams < ActiveRecord::Migration
  def change
    create_table :races do |t|
      t.string :name
      t.datetime :race_datetime
      t.integer :max_teams
      t.integer :racers_per_team
      t.timestamps
    end

    create_table :teams do |t|
      t.string :name
      t.text :description
      t.string :twitter
      t.timestamps

      t.belongs_to :race
    end
  end
end
