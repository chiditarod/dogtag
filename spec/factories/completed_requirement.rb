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
FactoryGirl.define do
  factory :completed_requirement, aliases: [:cr] do
    requirement
    team
    user
  end

  trait :with_metadata do
    transient do
      hash {{
        'foo' => 'bar',
        'amount' => '7000'
      }}
    end
    metadata { JSON.generate(hash) }
  end
end
