person = lambda do |json, person|
  json.extract! person, :id, :first_name, :last_name, :email, :phone
end

team = @team
json.staff_team do
  json.id team.id
  json.race_id team.race_id
  json.finalized team.finalized?
  json.team_number team.assigned_team_number
  json.new_team team.new_team
  json.new_team_overridden team.new_team_overridden ? true : false
  json.new_team_setting team.new_team_setting
  json.computed_new_team team.computed_new_team
  json.years_raced team.person_experience
  json.collaborating team.collaborating
  json.racing_with team.racing_with_names
  if team.captain
    json.captain { person.call(json, team.captain) }
  else
    json.captain nil
  end
  json.captain_inferred team.captain_inferred ? true : false
  json.account_holder { person.call(json, team.user) }
  json.sent_emails_count @sent_emails_count
  json.payments @payments do |payment|
    json.id payment.id
    json.requirement_id payment.requirement_id
    json.name payment.requirement.name
    json.amount_cents payment.amount_cents
    json.paid_at payment.created_at
    json.status payment.payment_status
  end
  json.can @can
end
