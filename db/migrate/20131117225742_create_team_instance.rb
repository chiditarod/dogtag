class CreateTeamInstance < ActiveRecord::Migration
  def change
    create_table :team_instances do |t|
      t.string :name
      t.string :description
      t.string :twitter

      t.belongs_to :race
      t.belongs_to :team
    end
  end
end
