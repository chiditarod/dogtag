class AddTiktokToPeopleAndRemoveTwitter < ActiveRecord::Migration[8.0]
  def change
    add_column :people, :tiktok, :text
    remove_column :people, :twitter, :text
  end
end
