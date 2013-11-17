class CreatePeople < ActiveRecord::Migration
  def change
    create_table :people do |t|
      t.string :first_name
      t.string :last_name
      t.string :email
      t.string :phone
      t.string :twitter

      t.belongs_to :team_instance
    end
  end
end
