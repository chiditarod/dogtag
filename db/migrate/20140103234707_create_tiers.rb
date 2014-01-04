class CreateTiers < ActiveRecord::Migration
  def change
    create_table :tiers do |t|
      t.belongs_to :requirement
      t.decimal :price, :precision => 8, :scale => 2 # 999,999.99 max
      t.datetime :begin_at
      t.timestamps
    end
  end
end
