# Copyright (C) 2014 Devin Breen
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
# I originally wanted to use JsonForm to store this per-race, but I couldn't get it
# to work and well, there's deadlines.
class AddQuestionsToRegistration < ActiveRecord::Migration[5.1]
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
