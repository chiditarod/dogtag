class AddCommentsToRegistration < ActiveRecord::Migration
  def change
    add_column :registrations, :private_comments, :text
  end
end
