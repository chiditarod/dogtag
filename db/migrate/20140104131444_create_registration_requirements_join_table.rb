class CreateRegistrationRequirementsJoinTable < ActiveRecord::Migration
  def change
    create_table :registration_requirements do |t|
      t.belongs_to :registration
      t.belongs_to :requirement
      t.belongs_to :user
      t.timestamps
    end

    add_index :registration_requirements, [:registration_id, :requirement_id],
      :unique => true, :name => 'req_req_unique'
  end
end
