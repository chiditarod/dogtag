json.teams @teams do |team|
  json.partial! "api/v1/teams/team", team: team
end
