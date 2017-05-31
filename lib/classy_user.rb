# Copyright (C) 2017 Devin Breen
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
class ClassyUser

  # associate dogtag user account with an existing classy user, or tell classy
  # to make a new association and send them an invite to the classy platform.
  def self.link_user_to_classy!(user, race)

    return user if user.classy_id.present?

    cc = ClassyClient.new

    if result = cc.get_member(user.email)
      user.classy_id = result['id']
      user.save!
      user
    else
      campaign_data = cc.get_campaign(race.classy_campaign_id)
      organization_id = campaign_data['organization_id']

      result = cc.create_member(organization_id, user.first_name, user.last_name, user.email)
      user.classy_id = result['id']
      user.save!
      user
    end
  end
end
