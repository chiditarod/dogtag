class RegistrationValidator < ActiveModel::Validator

  def validate(record)
    validate_race_is_open record
  end

  private

  def validate_race_is_open(record)
    return if record.race.blank?
    unless record.race.open_for_registration?
      record.errors[:race] << 'must be open for registration'
    end
  end

end
