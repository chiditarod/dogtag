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
  # TODO: do not inject race, instead inject an org_id
  def self.link_user_to_classy!(user, race)
    cc = ClassyClient.new
    campaign_data = cc.get_campaign(race.classy_campaign_id)
    organization_id = campaign_data['organization_id']

    response = cc.create_member(organization_id, user.first_name, user.last_name, user.email)
    b = JSON.parse(response.body)

    # a 200 response means the classy API created both a member and supporter record
    # the only time we seem to have access to the classy id is during member creation
    if response.ok?
      user.classy_id = b['id']
      user.save!
      Rails.logger.info "successfully created classy organization member with classy id: #{user.classy_id}"
      return user
    end

    # a 400 response with email already used means classy knows about this user but it's
    # unclear if a classy supporter exists for the classy org
    err_email_used = /This email address is already used/
    if response.code == 400 &&
      b.dig("error", "email_address").is_a?(Array) &&
      b.dig("error", "email_address").index{|e| e =~ err_email_used} != nil

      Rails.logger.info "classy reported member account already exists for email: #{user.email}"

      # attempt to add the user as a supporter for the classy org id
      response = cc.create_supporter(organization_id, user.first_name, user.last_name, user.email)
      b = JSON.parse(response.body)

      # a 200 response means the classy API created a supporter record and we're done
      if response.ok?
        Rails.logger.info "successfully created classy organization supporter with classy id: #{user.classy_id}"
        return user
      end

      # a 400 response with the member already being a supporter means we're done
      err_member_id_used = /is already a supporter for Organization/
      if response.code == 400 &&
        b.dig("error", "member_id").is_a?(Array) &&
        b.dig("error", "member_id").index{|e| e =~ err_member_id_used} != nil
        Rails.logger.info "classy reported supporter account already exists for email: #{user.email}"
        return user
      else
        raise TransientError.new("error: create_supporter: #{response.status}: #{response.body}")
      end
    else
      raise TransientError.new("error: create_member: #{response.status}: #{response.body}")
    end
  end
end
