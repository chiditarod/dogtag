# I originally wanted to use JsonForm to store this per-race, but I couldn't get it
# to work and well, there's deadlines.
class AddQuestionsToRegistration < ActiveRecord::Migration
  def change
    add_column :registrations, :racer_type, :string
    add_column :registrations, :primary_inspiration, :string
    add_column :registrations, :rules_confirmation, :boolean
    add_column :registrations, :sabotage_confirmation, :boolean
    add_column :registrations, :cart_deposit_confirmation, :boolean
    add_column :registrations, :food_confirmation, :boolean
    add_column :registrations, :experience, :integer
    add_column :registrations, :buddies, :string
    add_column :registrations, :wildcard, :string
  end
end
