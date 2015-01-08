class PersonValidator < ActiveModel::Validator
  def validate(record)
    validate_person_count record
  end

  def validate_person_count(record)
    if record.team.present? && record.team.race.present?
      if record.team.people.count == record.team.race.people_per_team
        record.errors[:maximum] << "people already added to this team"
      end
    end
  end
end
