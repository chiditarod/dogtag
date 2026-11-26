json.races @races do |race|
  json.partial! "api/v1/staff/races/staff_race", race: race
  json.teams @team_counts[race.id]
end
