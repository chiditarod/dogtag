class CreateRacers < ActiveRecord::Migration
  def change
    create_table :racers do |t|
      t.string :first_name
      t.string :last_name
      t.string :email
      t.string :phone
      t.string :twitter

      t.belongs_to :team
    end
  end
end
