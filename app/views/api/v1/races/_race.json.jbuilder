json.extract! race, :id, :name, :race_datetime, :registration_open, :registration_close, :final_edits_close,
              :people_per_team, :experience_labels, :time_zone
json.open_for_registration race.open_for_registration?
json.full race.full?
jsonform =
  begin
    JSON.parse(race.jsonform) if race.jsonform.present?
  rescue JSON::ParserError
    nil
  end
json.jsonform jsonform
json.stripe_publishable_key Rails.configuration.stripe[:publishable_key]
json.payment_requirements race.requirements.select { |requirement| requirement.is_a?(PaymentRequirement) } do |requirement|
  json.extract! requirement, :id, :name, :type
  json.current_price_cents requirement.amount_due_cents
  json.next_tier(requirement.next_tiers.first&.then { |tier| { price_cents: tier.price, begins_at: tier.begin_at } })
end
