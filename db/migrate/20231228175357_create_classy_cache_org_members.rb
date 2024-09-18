class CreateClassyCacheOrgMembers < ActiveRecord::Migration[5.2]
  def up
    create_table :classy_cache_org_members do |t|
      t.integer :classy_org_id
      t.string :email
      t.integer :classy_member_id
      t.timestamp :classy_updated_at
    end

    add_index :classy_cache_org_members, [:email, :classy_member_id, :classy_updated_at], unique: true, name: 'index_classy_org_members'
  end

  def down
    drop_table :classy_cache_org_members
    remove_index :classy_cache_org_members, [:email, :classy_member_id, :classy_updated_at]
  end
end
