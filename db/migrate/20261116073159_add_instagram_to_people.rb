class AddInstagramToPeople < ActiveRecord::Migration[8.0]
  def change
    add_column :people, :instagram, :text
  end
end
