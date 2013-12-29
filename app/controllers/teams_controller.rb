class TeamsController < ApplicationController
  before_filter :require_user
  respond_to :html

  def index
    race_id = params[:race_id] || session[:race_id]
    unless race_id
      flash[:error] = I18n.t('must_select_race')
      return redirect_to races_path
    end

    session[:race_id] = race_id
    @race = Race.find race_id
    @teams = current_user.teams
    respond_with @teams
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
    team = Team.where(:id => params[:id]).first

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
    @team = Team.where(:id => params[:id]).first
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
