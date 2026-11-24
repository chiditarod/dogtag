json.race do
  json.extract! @race, :id, :name, :time_zone, :max_teams
  json.finalized_count @finalized.size
  json.full @full
  json.open_for_registration @race.open_for_registration?
end
json.filter_fields @filter_fields
json.registering_kind @full ? "waitlist" : "registering"
json.viewer do
  json.staff @staff
  json.can_email @can_email
end
positions = waitlist_positions
json.finalized @finalized, partial: "team", as: :team, locals: { positions: positions }
json.registering @registering, partial: "team", as: :team, locals: { positions: positions }
if @can_email
  json.emails do
    json.to Api::V1::RegistrationsController::MAIL_TO
    { finalized: @finalized, registering: @registering }.each do |tab, teams|
      json.set! tab do
        json.owners teams.map { |team| team.user.email }.uniq.sort
        json.racers teams.flat_map { |team| team.people.map(&:email) }.compact_blank.uniq.sort
      end
    end
  end
else
  json.emails nil
end
