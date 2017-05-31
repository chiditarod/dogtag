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
class RegistrationToTeamForeignKeys < ActiveRecord::Migration
  def up
    # completed requirements table
    remove_index  :completed_requirements, :name => :completed_requirements_index
    rename_column :completed_requirements, :registration_id, :team_id
    add_index     :completed_requirements, [:team_id, :requirement_id], :unique => true
    # people table
    rename_column :people, :registration_id, :team_id
  end

  def down
    # completed requirements table
    remove_index  :completed_requirements, [:team_id, :requirement_id]
    rename_column :completed_requirements, :team_id, :registration_id
    add_index :completed_requirements, [:registration_id, :requirement_id],
      :unique => true, :name => 'completed_requirements_index'

    # people table
    rename_column :people, :team_id, :registration_id
  end
end
