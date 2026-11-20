class RemoveZipcodeFromPeople < ActiveRecord::Migration[8.0]
  def change
    remove_column :people, :zipcode, :text
  end
end
