class TeamValidator < ActiveModel::Validator
  def validate(record)
    validate_jsonform(record) if record.jsonform.present?
  end

  def validate_jsonform(record)
    schema = JSON.parse(record.race.jsonform)['schema']
    data = record.jsonform
    errors = JSON::Validator.fully_validate(schema, data)
    record.errors[:questions] = errors if errors.any?
  end
end
