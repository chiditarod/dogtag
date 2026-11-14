class Api::V1::TeamsController < Api::V1::BaseController
  before_action :require_api_user!

  def index
    authorize!(:index, Team)
    @teams = Team.where(user: current_user).order(created_at: :desc).includes(:people, race: :requirements)
  end

  def show
    @team = Team.includes(:people, race: :requirements).find(params[:id])
    authorize!(:show, @team)
  end

  def create
    authorize!(:create, Team)
    @race = Race.find(params[:race_id])
    unless @race.open_for_registration? || current_user.is_any_of?(:admin, :operator)
      raise CanCan::AccessDenied.new(I18n.t("api.errors.registration_closed"))
    end

    @team = Team.new(params.expect(team: [:name, :description, :experience]))
    @team.subscribe(TeamAuditor.new)
    @team.user = current_user
    @team.race = @race

    if @team.save
      render :show, status: :created
    else
      render_errors(@team)
    end
  end

  def update
    @team = Team.find(params[:id])
    authorize!(:show, @team)
    authorize_update!(@team, @team)
    @team.subscribe(TeamAuditor.new)

    if @team.update(params.expect(team: [:name, :description, :experience]))
      render :show
    else
      render_errors(@team)
    end
  end
end
