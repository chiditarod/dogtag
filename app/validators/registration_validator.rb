class RegistrationValidator < ActiveModel::Validator

  def validate(record)
    validate_team_count record
    validate_person_count record
  end

  private

  def validate_team_count(record)
    if record.race.present? && record.race.teams.present?
      if record.race.teams.count == record.race.max_teams
        record.errors[:max_teams] << 'Teams must be less than or equal to max_teams'
      end
    end
  end

  def validate_person_count(record)
    if record.race.present?
      if record.people.count > record.race.people_per_team
        record.errors[:people_per_team] << 'People must be less than or equal to max_people_per_team'
      end
    end
  end
end
