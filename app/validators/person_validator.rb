class PersonValidator < ActiveModel::Validator
  def validate(record)
    validate_person_count record
  end

  def validate_person_count(record)
    if record.registration.present? && record.registration.race.present?
      if record.registration.people.count == record.registration.race.people_per_team
        record.errors[:maximum] << "people already added to this registration"
      end
    end
  end
end
