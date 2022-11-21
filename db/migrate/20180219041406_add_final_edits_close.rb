class AddFinalEditsClose < ActiveRecord::Migration[5.1]
  def up
    add_column :races, :final_edits_close, :datetime

    # add a default value to all existing records
    execute <<-SQL
      UPDATE races
      SET final_edits_close = registration_close + INTERVAL '1 hour';
    SQL

    # now set the field to not allow null
    change_column_null :races, :final_edits_close, false
  end

  def down
    remove_column :races, :final_edits_close
  end
end
