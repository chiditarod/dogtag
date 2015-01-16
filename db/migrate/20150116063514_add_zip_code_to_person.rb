class AddZipCodeToPerson < ActiveRecord::Migration
  def up
    # add new column, allowing null
    add_column :people, :zipcode, :string

    # add a default value to all existing records
    execute <<-SQL
      UPDATE people
      SET zipcode = '00000'
    SQL

    # now set the field to not allow null
    change_column_null :people, :zipcode, false
  end

  def down
    remove_column :people, :zipcode
  end
end
