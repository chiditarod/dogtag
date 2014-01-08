class RegistrationValidator < ActiveModel::Validator

  def validate(record)
    validate_team_count record
  end

  private

  def validate_team_count(record)
    if record.race.present? && record.race.teams.present?
      if record.race.teams.count == record.race.max_teams
        record.errors[:max_teams] << 'Teams must be less than or equal to max_teams'
      end
    end
  end
end
