class ChangeRegStrsToTexts < ActiveRecord::Migration

  def up
    # go text or go home
    change_column :registrations, :name, :string, :limit => 1000
    change_column :registrations, :description, :text
    change_column :registrations, :private_comments, :text
  end

  def down
    # This will cause trouble if you have strings longer
    # than 255 characters.
    change_column :registrations, :name, :string
    change_column :registrations, :description, :string
    change_column :registrations, :private_comments, :string
  end

end
