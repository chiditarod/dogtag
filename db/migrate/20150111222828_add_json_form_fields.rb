class AddJsonFormFields < ActiveRecord::Migration
  def up
    add_column :races, :jsonform, :text
    add_column :teams, :jsonform, :text
  end

  def down
    remove_column :races, :jsonform
    remove_column :teams, :jsonform
  end
end
