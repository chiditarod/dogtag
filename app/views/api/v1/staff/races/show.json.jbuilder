json.race do
  json.partial! "api/v1/staff/races/staff_race", race: @race
  json.extract! @race, :people_per_team, :jsonform, :classy_campaign_id, :classy_default_goal, :confirmation_text
  json.full @race.full?
  json.filter_field @race.filter_field_array
  json.experience_labels_text @race.experience_labels_text
  json.confirmation_text_max_length Race::CONFIRMATION_TEXT_MAX_LENGTH
  json.money @race.money_totals
  counts = @team_counts[@race.id]
  json.teams do
    json.finalized counts[:finalized]
    json.total counts[:total]
    json.registering counts[:total] - counts[:finalized]
  end
  json.racer_emails @racer_emails
  json.payment_requirements @race.requirements.select { |requirement| requirement.is_a?(PaymentRequirement) } do |requirement|
    json.extract! requirement, :id, :name, :type
    json.enabled requirement.enabled?
    json.current_price_cents requirement.active_tier.presence&.price
    json.tier_count requirement.tiers.size
  end
  json.can_destroy can?(:destroy, @race)
  json.has_teams counts[:total].positive?
end
json.time_zones Race.selectable_time_zones.sort
