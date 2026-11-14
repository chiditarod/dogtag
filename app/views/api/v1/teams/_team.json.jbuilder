json.extract! team, :id, :name, :description, :experience
json.race do
  json.partial! "api/v1/races/race", race: team.race
end
json.people team.people.sort_by(&:id) do |person|
  json.partial! "api/v1/people/person", person: person
end
json.checklist TeamChecklist.new(team).to_h
