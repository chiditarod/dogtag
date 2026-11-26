# Parses the wall-clock date strings the staff race form sends ("2026-12-07T12:00")
# in the race's zone. A time that falls in a spring-forward gap does not exist, and
# ActiveSupport would silently shift it an hour, so it is refused instead.
class RaceDateParams
  FIELDS = %w[registration_open registration_close final_edits_close race_datetime].freeze
  FORMAT = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\z/

  # Returns [parsed, errors]: attrs with each date string turned into a time in
  # `zone`, and { field => [message] } for any that could not be.
  def self.call(attrs, zone:)
    parsed = {}
    errors = {}
    attrs.each do |key, value|
      next parsed[key] = value unless FIELDS.include?(key)

      time, error = parse(value, zone)
      error ? errors[key] = [error] : parsed[key] = time
    end
    [parsed, errors]
  end

  def self.parse(value, zone)
    return [nil, "Enter a date and time"] if value.blank?
    return [nil, "must be a date and time"] unless FORMAT.match?(value)

    time = zone.parse(value)
    return [time, nil] if time && time.strftime("%Y-%m-%dT%H:%M") == value[0, 16]

    [nil, "doesn't exist in #{zone.tzinfo.name}: the clocks jump forward that night"]
  end
  private_class_method :parse
end
