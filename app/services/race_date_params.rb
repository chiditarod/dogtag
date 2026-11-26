# Parses the wall-clock date strings the staff race form sends ("2026-12-07T12:00")
# in the race's zone. A time that falls in a spring-forward gap does not exist, and
# ActiveSupport would silently shift it an hour, so it is refused instead.
class RaceDateParams
  FIELDS = %w[registration_open registration_close final_edits_close race_datetime].freeze
  FORMAT = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\z/

  # Returns [parsed, errors]: attrs with each date string turned into a time in
  # `zone`, and { field => [message] } for any that could not be. `fields` names
  # the keys to parse (the race fields by default; a tier passes %w[begin_at]).
  def self.call(attrs, zone:, fields: FIELDS)
    parsed = {}
    errors = {}
    attrs.each do |key, value|
      next parsed[key] = value unless fields.include?(key)

      time, error = parse(value, zone)
      error ? errors[key] = [error] : parsed[key] = time
    end
    [parsed, errors]
  end

  def self.parse(value, zone)
    return [nil, "Enter a date and time"] if value.blank?
    return [nil, "must be a date and time"] unless value.is_a?(String) && FORMAT.match?(value) && real_time?(value)

    time = zone.parse(value)
    return [time, nil] if time.strftime("%Y-%m-%dT%H:%M") == value[0, 16]

    [nil, "doesn't exist in #{zone.tzinfo.name}: the clocks jump forward that night"]
  end

  # The shape is right; check the parts exist (no month 13, February 30 or hour 25).
  def self.real_time?(value)
    year, month, day, hour, minute, second = value.scan(/\d+/).map(&:to_i)
    Date.valid_date?(year, month, day) && hour < 24 && minute < 60 && second.to_i < 60
  end
  private_class_method :parse, :real_time?
end
