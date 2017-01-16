class AddClassyToRace < ActiveRecord::Migration
  def up
    add_column :races, :classy_campaign_id,  :integer
    add_column :races, :classy_default_goal, :integer
  end

  def down
    remove_column :races, :classy_campaign_id
    remove_column :races, :classy_default_goal
  end
end
