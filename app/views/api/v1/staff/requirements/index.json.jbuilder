json.race do
  json.partial! "api/v1/staff/requirements/fee_race", race: @race
end
json.requirements @requirements do |requirement|
  json.partial! "api/v1/staff/requirements/fee", requirement: requirement, counts: @payment_counts[requirement.id]
end
json.types @types
