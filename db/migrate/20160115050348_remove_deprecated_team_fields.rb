class RemoveDeprecatedTeamFields < ActiveRecord::Migration
  def up
    remove_column :teams, :racer_type
    remove_column :teams, :primary_inspiration
    remove_column :teams, :rules_confirmation
    remove_column :teams, :sabotage_confirmation
    remove_column :teams, :cart_deposit_confirmation
    remove_column :teams, :food_confirmation
  end

  def down
    puts "this is a one-way journey. these fields are no longer used anyway."
  end
end
