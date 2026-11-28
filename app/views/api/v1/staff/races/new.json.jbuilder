json.race do
  json.extract! @race, :name, :time_zone, :max_teams, :people_per_team, :registration_open, :registration_close,
    :final_edits_close, :race_datetime, :jsonform, :classy_campaign_id, :classy_default_goal, :confirmation_text
  json.filter_field @race.filter_field_array
  json.experience_labels_text @race.experience_labels_text
  json.confirmation_text_max_length Race::CONFIRMATION_TEXT_MAX_LENGTH
end
json.time_zones Race.selectable_time_zones.sort
