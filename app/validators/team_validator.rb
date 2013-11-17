class TeamValidator < ActiveModel::Validator

  def validate(record)
    validate_person_count record
  end

  private

  def validate_person_count(record)
    if record.race.present?
      if record.people.count > record.race.people_per_team
        record.errors[:people_per_team] << 'People must be less than or equal to max_people_per_team'
      end
    end
  end
end
