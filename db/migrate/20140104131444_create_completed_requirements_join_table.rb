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
class CreateCompletedRequirementsJoinTable < ActiveRecord::Migration[5.1]
  def change
    create_table :completed_requirements do |t|
      t.belongs_to :registration
      t.belongs_to :requirement
      t.belongs_to :user
      t.text :metadata
      t.timestamps null: true
    end

    add_index :completed_requirements, [:registration_id, :requirement_id],
      :unique => true, :name => 'completed_requirements_index'
  end
end
