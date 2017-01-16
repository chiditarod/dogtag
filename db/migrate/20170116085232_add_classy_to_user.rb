class AddClassyToUser < ActiveRecord::Migration
  def up
    add_column :users, :classy_id, :integer
  end

  def down
    remove_column :users, :classy_id
  end
end
