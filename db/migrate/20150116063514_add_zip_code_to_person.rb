# Copyright (C) 2015 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
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
