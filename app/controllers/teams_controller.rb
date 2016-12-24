class TeamsController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def index
    @myteams = Team.where(:user => current_user).order(created_at: :desc)
    if params[:race_id].present?
      begin
        @race = Race.find params[:race_id]
        @myteams = @myteams.where(:race_id => @race.id)
      rescue ActiveRecord::RecordNotFound
        flash[:error] = "Race not found"
      end
    end
  end

  def new
    unless params[:race_id]
      flash[:error] = I18n.t('must_select_race')
      return redirect_to races_path
    end

    session[:signup_race_id] = params[:race_id]
    @race = Race.find(params[:race_id])
    @team = Team.new
    @team.race = @race
  end

  def create
    return render :status => 400 if params[:team].blank?

    @team = Team.new team_params

    @team.user = current_user
    race_id = params[:race_id] || session[:signup_race_id]
    @team.race ||= Race.find(race_id)

    if @team.save
      flash.now[:notice] = I18n.t('create_success')
      return redirect_to team_questions_path(@team)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @team.errors.messages
    end
  end

  def show
    @team = Team.find params[:id]

    # check and do stuff if this team is now unfinalized for some reason
    unprocess_if_newly_unfinalized

    # check if the team now meets all finalization criteria and do stuff if so
    process_if_newly_finalized

    @race = @team.race

    # currently required by charges controller to know where to redirect
    # the user after performing an action
    session[:prior_url] = request.original_url
  end

  alias edit show

  def update
    @team = Team.find params[:id]
    @race = @team.race
    try_to_update(@team, team_params, team_questions_path(@team))
  end

  # TODO: only allow delete if no payments
  def destroy
    @team = Team.find params[:id]
    try_to_delete(@team, teams_path)
  end

  private

  def team_params
    params
      .require(:team)
      .permit(:race_id, :name, :description, :experience)
  end

  def process_if_newly_finalized
    # precaution to ensure the team cannot be finalized unless by the owner or an admin-style user
    return unless (current_user == @team.user || current_user.is_any_of?(:admin, :operator))

    if @team.finalize
      @display_notification = :notify_now_complete
      @team.reload
    end
  end

  def unprocess_if_newly_unfinalized
    if !@team.meets_finalization_requirements? && @team.finalized
      @team.unfinalize
      @team.reload
    end
  end
end
