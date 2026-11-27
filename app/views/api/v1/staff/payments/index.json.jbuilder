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
  # A refund found already made at Stripe has no refunder here; say where it was done.
  json.refunded_by(if cr.refunded_by
                     { name: [cr.refunded_by.first_name, cr.refunded_by.last_name].compact_blank.join(" ") }
                   elsif cr.refunded_at && cr.stripe_refund_id.present?
                     { name: "Done at Stripe" }
                   end)
  json.reopened_at cr.reopened_at
  json.reopened_by(({ name: [cr.reopened_by.first_name, cr.reopened_by.last_name].compact_blank.join(" ") } if cr.reopened_by))
end
# Operators and admins may reopen a refunded payment; refunders may only refund.
json.can_reopen can?(:reopen, :charges)
json.meta @search.meta
json.filters @search.filters
