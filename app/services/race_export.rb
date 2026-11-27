require "csv"

# The team CSV for a race, shared by the legacy admin and the staff API.
class RaceExport
  TYPE = "text/csv; charset=utf-8; header=present".freeze

  def self.call(race_id, finalized: false)
    teams = finalized ? Team.export(race_id, finalized: true) : Team.export(race_id)
    data = CSV.generate { |csv| teams.each { |row| csv << row } }
    { data: data, filename: "race_#{race_id}_export.csv", type: TYPE }
  end
end
