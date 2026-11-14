# Admin datetime fields are entered and shown in the race's own time zone,
# while storage stays UTC. Including controllers define #race_time_zone.
module RaceTimeZone
  extend ActiveSupport::Concern

  private

  def use_race_time_zone(&)
    Time.use_zone(race_time_zone || Time.zone, &)
  end
end
