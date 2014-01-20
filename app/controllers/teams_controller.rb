class TeamsController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def index
    if race_id = (params[:race_id] || session[:last_race_id])
      @race = Race.find race_id
      session[:last_race_id] = @race.id
    end
    @teams = current_user.teams
  end

  def edit
    @team = Team.find params[:id]
  end

  def new
    @team = Team.new
  end

  def create
    return render :status => 400 if params[:team].blank?

    @team = Team.new team_params
    if @team.valid?
      @team.user = current_user
      @team.save

      if session[:last_race_id]
        flash[:notice] = I18n.t('create_success_with_race')
        redirect_to new_race_registration_url(:race_id => session[:last_race_id], :team_id => @team.id)
      else
        flash[:notice] = I18n.t('create_success')
        redirect_to teams_path
      end

    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @team.errors.messages
    end
  end

  def update
    team = Team.find params[:id]

    if team.update_attributes team_params
      flash[:notice] = I18n.t('update_success')
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << team.errors.messages
    end
    redirect_to teams_path
  end

  def destroy
    @team = Team.find params[:id]

    if @team.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t '.delete_failed'
    end
    redirect_to teams_path
  end

  private

  def team_params
    params.require(:team).permit(:name)
  end

end
