# Using single table inheritance (STI)
class CreateRequirements < ActiveRecord::Migration
  def change
    create_table :requirements do |t|
      t.belongs_to :race
      t.string :type
      t.string :name
      t.timestamps
    end
  end
end
