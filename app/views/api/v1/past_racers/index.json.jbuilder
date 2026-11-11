json.past_racers @past_racers do |person|
  json.extract! person, :first_name, :last_name, :email, :phone, :zipcode, :experience, :twitter
  json.last_team_name person.team.name
  json.last_race_name person.team.race.name
  json.last_raced_year person.team.race.race_datetime&.year
end
