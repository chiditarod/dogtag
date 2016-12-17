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
