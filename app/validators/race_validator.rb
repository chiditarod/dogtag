class RaceValidator < ActiveModel::Validator

  def validate(record)
    validate_open_and_close_dates(record) if datetimes_parse?(record)
  end

  private

  def validate_open_and_close_dates(record)
    unless record.registration_open < record.registration_close
      record.errors.add(:registration_open, 'must come before registration_close')
    end
    unless record.registration_open < record.race_datetime
      record.errors.add(:registration_open, 'must come before race_datetime')
    end
    unless record.registration_close < record.race_datetime
      record.errors.add(:registration_close, 'must come before race_datetime')
    end
  end

  def datetimes_parse?(record)
    dates = [:race_datetime, :registration_open, :registration_close]
    dates.each do |d|
      begin
        DateTime.parse record.__send__(d).to_s
      rescue ArgumentError
        record.errors.add(d, 'must be a valid datetime')
      end
    end
    record.errors.count == 0
  end
end
