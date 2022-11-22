# Copyright (C) 2016 Devin Breen
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
class RemoveDeprecatedTeamFields < ActiveRecord::Migration[5.1]
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
