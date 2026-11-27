json.race do
  json.extract! race, :id, :name
  json.year race.local(race.race_datetime).year
end
