# Race setup for staff (operator, admin). Refunders pass the base controller's check but
# not the race one, so they get 403 here.
class Api::V1::Staff::RacesController < Api::V1::Staff::BaseController
  include RaceTimeZone

  RACE_FIELDS = %i[name time_zone max_teams people_per_team jsonform experience_labels_text classy_campaign_id
    classy_default_goal confirmation_text].freeze
  TIME_ZONE_NEEDS_DATES = "send every date when you change the time zone".freeze

  before_action { authorize!(:update, Race) }
  # Before the around_action, which reads the stored zone through @race.
  before_action :load_race, only: [:update, :destroy, :export]
  around_action :use_race_time_zone, only: [:create, :update]

  def index
    @races = Race.includes(:requirements).order(race_datetime: :desc, id: :desc).to_a
    Race.preload_registration_data(@races)
    @team_counts = team_counts(@races)
  end

  def show
    @race = Race.find(params[:id])
    prepare_show
  end

  def create
    authorize!(:create, Race)
    @race = Race.new
    save_race { render_saved(:created) }
  end

  def update
    authorize!(:update, @race)
    save_race { render_saved(:ok) }
  end

  def destroy
    authorize!(:destroy, @race)
    return render_errors("Delete or move this race's teams first", code: "race_has_teams") if @race.teams.exists?

    Race.transaction do
      # Tiers go with their requirement (dependent: :delete_all), so nothing is left behind.
      @race.requirements.each(&:destroy!)
      @race.destroy!
    end
    head :no_content
  end

  # A plain same-origin download link, so it answers with the file, not JSON.
  def export
    authorize!(:export, @race)
    result = RaceExport.call(@race.id, finalized: params[:finalized] == "true")
    send_data result[:data], filename: result[:filename], type: result[:type]
  end

  private

  def load_race
    @race = Race.find(params[:id])
  end

  # Same rule as the legacy RacesController: a submitted valid zone wins (the dates are read
  # in it), else the stored race's, else the default.
  def race_time_zone
    submitted = params[:race][:time_zone] if params[:race].is_a?(ActionController::Parameters)
    return submitted if Race.valid_time_zone?(submitted)

    @race&.time_zone || Race::DEFAULT_TIME_ZONE
  end

  # Reloads the race with everything the staff race view reads.
  def prepare_show
    @race = Race.includes(:requirements).find(@race.id)
    Race.preload_registration_data([@race])
    @team_counts = team_counts([@race])
    @racer_emails = Person.where(team_id: @race.finalized_teams.select(:id)).distinct.order(:email).pluck(:email)
  end

  def render_saved(status)
    prepare_show
    render :show, status:
  end

  # Assigns the submitted fields, reads the date strings in the race's zone (Time.zone, set by
  # the around_action) and saves only when the model and the date parsing are both clean.
  def save_race
    attrs = race_params
    if (error = time_zone_change_error(attrs))
      @race.errors.add(:time_zone, error)
      return render_errors(@race)
    end

    parsed, date_errors = RaceDateParams.call(attrs, zone: Time.zone)
    @race.assign_attributes(parsed)
    @race.valid?
    # A date that could not be read was not assigned, so the model's complaint about it
    # ("can't be blank" on create) would only repeat the reason.
    date_errors.each do |field, messages|
      @race.errors.delete(field)
      messages.each { |message| @race.errors.add(field, message) }
    end
    return render_errors(@race) if @race.errors.any?

    @race.save!
    yield
  end

  def race_params
    attrs = params.expect(race: [*RACE_FIELDS, *RaceDateParams::FIELDS, { filter_field: [] }]).to_h
    attrs["filter_field"] = attrs["filter_field"].reject(&:blank?).join(",") if attrs.key?("filter_field")
    attrs
  end

  # Dates are read in the submitted zone, so changing the zone without re-sending every date
  # would silently shift the stored moments.
  def time_zone_change_error(attrs)
    return unless @race.persisted? && attrs.key?("time_zone") && attrs["time_zone"] != @race.time_zone

    TIME_ZONE_NEEDS_DATES unless RaceDateParams::FIELDS.all? { |field| attrs.key?(field) }
  end

  # { race_id => { finalized:, total: } } in one grouped query.
  def team_counts(races)
    rows = Team.where(race_id: races.map(&:id)).group(:race_id)
      .pluck(:race_id, Arel.sql("COUNT(*)"), Arel.sql("COUNT(*) FILTER (WHERE finalized)"))
    rows.to_h { |race_id, total, finalized| [race_id, { finalized:, total: }] }
      .tap { |counts| counts.default = { finalized: 0, total: 0 } }
  end
end
