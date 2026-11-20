json.person do
  json.partial! "api/v1/people/person", person: @person
end
json.checklist @checklist
# Adding the account holder can make them captain, so the SPA refreshes the team's captain from here.
json.captain_id @team.captain_id
