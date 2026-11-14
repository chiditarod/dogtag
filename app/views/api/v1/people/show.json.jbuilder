json.person do
  json.partial! "api/v1/people/person", person: @person
end
json.checklist @checklist
