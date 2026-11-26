json.users @users do |user|
  json.partial! "api/v1/staff/users/staff_user", user: user
  json.teams user.teams.sort_by { |team| [team.race.race_datetime, team.race_id, team.id] }.reverse do |team|
    json.extract! team, :id, :name
    json.partial! "api/v1/staff/users/team_race", race: team.race
  end
end
json.meta @meta
