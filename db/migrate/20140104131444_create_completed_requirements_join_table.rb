class CreateCompletedRequirementsJoinTable < ActiveRecord::Migration
  def change
    create_table :completed_requirements do |t|
      t.belongs_to :registration
      t.belongs_to :requirement
      t.belongs_to :user
      t.timestamps
    end

    add_index :completed_requirements, [:registration_id, :requirement_id],
      :unique => true, :name => 'completed_requirements_index'
  end
end
