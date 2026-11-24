person = ->(user) { { name: [user.first_name, user.last_name].compact_blank.join(" "), email: user.email } if user }

json.payments @search.payments do |cr|
  json.id cr.id
  json.race { json.extract! cr.requirement.race, :id, :name }
  json.team { json.extract! cr.team, :id, :name }
  json.owner person.call(cr.team.user)
  json.paid_by person.call(cr.user)
  json.payment_type cr.requirement.name
  json.amount_cents cr.amount_cents
  json.paid_at cr.created_at
  json.status cr.payment_status
  json.refunded_at cr.refunded_at
  json.refunded_by cr.refunded_by && { name: [cr.refunded_by.first_name, cr.refunded_by.last_name].compact_blank.join(" ") }
end
json.meta @search.meta
json.filters @search.filters
