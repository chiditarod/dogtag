# Race setup for staff (operator, admin). Refunders pass the base controller's check but
# not the race one, so they get 403 here.
class Api::V1::Staff::RacesController < Api::V1::Staff::BaseController
  before_action { authorize!(:update, Race) }

  def index
    @races = Race.includes(:requirements).order(race_datetime: :desc, id: :desc).to_a
    Race.preload_registration_data(@races)
    @team_counts = team_counts(@races)
  end

  def show
    @race = Race.includes(:requirements).find(params[:id])
    Race.preload_registration_data([@race])
    @team_counts = team_counts([@race])
    @racer_emails = Person.where(team_id: @race.finalized_teams.select(:id)).distinct.order(:email).pluck(:email)
  end

  private

  # { race_id => { finalized:, total: } } in one grouped query.
  def team_counts(races)
    rows = Team.where(race_id: races.map(&:id)).group(:race_id)
      .pluck(:race_id, Arel.sql("COUNT(*)"), Arel.sql("COUNT(*) FILTER (WHERE finalized)"))
    rows.to_h { |race_id, total, finalized| [race_id, { finalized:, total: }] }
      .tap { |counts| counts.default = { finalized: 0, total: 0 } }
  end
end
