json.user do
  json.partial! "api/v1/staff/users/staff_user", user: @user
  json.created_at @user.created_at
  json.teams @user.teams.includes(:race).sort_by { |team| [team.race.race_datetime, team.race_id, team.id] }.reverse do |team|
    json.extract! team, :id, :name, :assigned_team_number
    json.finalized team.finalized?
    json.percent_complete team.percent_complete
    json.partial! "api/v1/staff/users/team_race", race: team.race
  end
  can_destroy = can?(:destroy, @user)
  json.can_edit can?(:staff_update, @user)
  json.can_destroy can_destroy
  json.is_self @user.id == current_user.id
  json.delete_blocker(can_destroy ? @user.deletion_blocker(by: current_user) : nil)
end
