json.extract! team, :id, :name
json.description team.description.presence
json.mine team.user_id == current_user.id
json.can_show @ability.can?(:show, team)
json.deletable @ability.can?(:destroy, team) && team.deletable?
json.percent_complete team.percent_complete
json.experience_label @race.experience_label(team.experience)
json.racer_years team.person_experience
json.answers answers_for(team)
json.waitlist_position positions[team.id]
json.created_at team.created_at
if @staff
  json.staff do
    json.assigned_team_number team.assigned_team_number
    json.payments_paid payments_paid(team)
    json.payments_total @enabled_requirement_ids.size
    json.updated_at team.updated_at
    json.new_team team.new_team
  end
else
  json.staff nil
end
