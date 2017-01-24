class AddClassyToTeam < ActiveRecord::Migration
  def up
    add_column :teams, :classy_id,                 :integer
    add_column :teams, :classy_fundraiser_page_id, :integer
  end

  def down
    remove_column :teams, :classy_id
    remove_column :teams, :classy_fundraiser_page_id
  end
end
