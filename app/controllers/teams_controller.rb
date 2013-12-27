class TeamsController < ApplicationController
  before_filter :require_user
  respond_to :html

  def index
    @teams = Team.all
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
    if @team.save
      flash[:notice] = I18n.t('create_success')
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @team.errors.messages
    end
    respond_with @team
  end

  def update
    return render :status => 400 unless params[:team]
    team = team.where(:id => params[:id]).first

    if team.update_attributes team_params
      flash[:notice] = 'team was successfully updated.'
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << team.errors.messages
    end
    redirect_to edit_team_path
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def destroy
    @team = team.where(:id => params[:id]).first
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
