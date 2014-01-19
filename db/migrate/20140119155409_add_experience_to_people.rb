class AddExperienceToPeople < ActiveRecord::Migration
  def change
    add_column :people, :experience, :integer
  end
end
