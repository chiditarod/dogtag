class RaceValidator < ActiveModel::Validator

  def validate(record)
    validate_datetimes record
  end

  private

  def validate_datetimes(record)
    dates = [:race_datetime, :registration_open, :registration_close]
    dates.each do |d|
      begin
        DateTime.parse record.__send__(d).to_s
      rescue ArgumentError
        record.errors.add(d, 'must be a valid datetime')
      end
    end
  end

end
