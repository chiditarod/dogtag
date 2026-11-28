# `counts` is { total:, unrefunded: } from one grouped query, so a list adds no queries per fee.
# Prices are the ones with a start, in start order; a legacy price without one never applies.
active = requirement.active_tier.presence
upcoming = requirement.next_tiers.first
dated = requirement.tiers.select(&:begin_at).sort_by(&:begin_at)

price = ->(tier) { tier && { price_cents: tier.price, begin_at: tier.begin_at } }

json.extract! requirement, :id, :race_id, :name, :type
json.enabled requirement.enabled?
json.current_tier price.call(active)
json.next_tier price.call(upcoming)
json.paid_team_count counts[:unrefunded]
json.tiers dated do |tier|
  status =
    if tier == active then "current"
    elsif tier == upcoming then "next"
    elsif tier.begin_at < Time.zone.now then "past"
    else "later"
    end
  json.id tier.id
  json.price_cents tier.price
  json.begin_at tier.begin_at
  json.status status
  json.can_destroy can?(:destroy, tier)
  json.destroy_blocked_reason tier.destroy_blocked_reason(paid: counts[:total].positive?, tier_count: dated.size)
end
json.can_destroy can?(:destroy, requirement)
json.destroy_blocked_reason requirement.destroy_blocked_reason(counts)
