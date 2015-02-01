class AddFilterFieldToRaces < ActiveRecord::Migration
  def up
    add_column :races, :filter_field, :string
  end

  def down
    remove_column :races, :filter_field
  end
end
