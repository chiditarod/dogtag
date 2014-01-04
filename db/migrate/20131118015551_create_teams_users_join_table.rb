class CreateTeamsUsersJoinTable < ActiveRecord::Migration
  def change
    # todo: migrate to http://guides.rubyonrails.org/migrations.html#creating-a-join-table
    create_table :teams_users, id: false do |t|
      t.integer :team_id
      t.integer :user_id
    end
  end
end
