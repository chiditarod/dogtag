class TeamsController < ApplicationController
  before_filter :require_user
  respond_to :html

  def index
    if race_id = (params[:race_id] || session[:last_race_id])
      @race = Race.find race_id
      session[:last_race_id] = @race.id
    end
    @teams = current_user.teams
  end

  def show
    @team = Team.find params[:id]
    respond_with @team
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    redirect_to teams_path
  end

  alias edit show

  def new
    @team = Team.new
  end

  def create
    return render :status => 400 if params[:team].blank?

    @team = Team.new team_params
    if @team.valid?
      @team.users << current_user
      @team.save
      flash[:notice] = I18n.t('create_success')
      redirect_to teams_path
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @team.errors.messages
      respond_with @team
    end
  end

  def update
    return render :status => 400 unless params[:team]
    team = Team.find params[:id]

    if team.update_attributes team_params
      flash[:notice] = I18n.t('update_success')
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << team.errors.messages
    end
    redirect_to teams_path
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def destroy
    @team = Team.find params[:id]
    return render :status => 400 if @team.nil?

    if @team.destroy
      flash[:notice] = t 'delete_success'
    else
      flash[:error] = t '.delete_failed'
    end
    redirect_to teams_path
  rescue ActiveRecord::RecordNotFound
    render :status => 400
  end

  private

  def team_params
    params.require(:team).permit(:name)
  end

end
