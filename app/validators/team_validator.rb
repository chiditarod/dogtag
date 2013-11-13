class TeamValidator < ActiveModel::Validator

  def validate(record)
    validate_racer_count record
  end

  private

  def validate_racer_count(record)
    if record.race.present?
      if record.racers.count > record.race.racers_per_team
        record.errors[:racers_per_team] << 'Racers must be less than or equal to max_racers_per_team'
      end
    end
  end
end
