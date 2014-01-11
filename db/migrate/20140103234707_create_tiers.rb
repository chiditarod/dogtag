class CreateTiers < ActiveRecord::Migration
  def change
    create_table :tiers do |t|
      t.belongs_to :requirement
      t.datetime :begin_at
      t.integer :price
      t.timestamps
    end
  end
end
