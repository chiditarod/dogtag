class Api::V1::TeamsController < Api::V1::BaseController
  before_action :require_api_user!

  def index
    authorize!(:index, Team)
    @teams = Team.where(user: current_user).order(created_at: :desc)
      .includes(:people, :completed_requirements, :requirements, race: :requirements).to_a
    Race.preload_registration_data(@teams.map(&:race))
  end

  def show
    @team = Team.includes(:people, race: :requirements).find(params[:id])
    authorize!(:show, @team)
  end

  def create
    authorize!(:create, Team)
    @race = Race.find(params[:race_id])
    raise CanCan::AccessDenied.new(I18n.t("api.errors.registration_closed")) unless @race.accepts_new_teams_from?(current_user)

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

    fields = [:name, :description, :experience]
    fields << :new_team_setting if StaffTeamPermissions.new_team_setter?(current_user)

    if @team.update(params.expect(team: fields))
      render :show
    else
      render_errors(@team)
    end
  end

  def destroy
    team = Team.find(params[:id])
    authorize!(:destroy, team)
    return render_errors(I18n.t("teams.destroy.has_payments"), status: :conflict, code: :has_payments) if team.completed_requirements.any?

    team.destroy!
    head :no_content
  end
end
