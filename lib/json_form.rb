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
class JsonForm

  def self.add_csrf(jsonform, auth_token)

    schema_addition = {
      'type' => 'string',
      'default' => auth_token
    }

    form_addition = {
      'type' => 'hidden',
      'key' => 'authenticity_token'
    }

    # add to schema object
    schema = jsonform['schema']['properties']
    schema['authenticity_token'] = schema_addition
    jsonform['schema']['properties'] = schema
    # add to form object
    jsonform['form'] << form_addition
    jsonform
  end

  def self.add_saved_answers(team, jsonform, auth_token)
    return jsonform unless team.has_saved_answers?

    # since 'value' will overwrite all form values, we have to include the authentication_token
    # see: https://github.com/joshfire/jsonform/wiki#using-previously-submitted-values-to-initialize-a-form
    auth_hash = { 'authenticity_token' => auth_token }
    jsonform.merge!(
      { 'value' => JSON.parse(team.jsonform).merge(auth_hash) }
    )
  end
end
