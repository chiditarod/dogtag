class RegistrationsController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def new
    unless params[:team_id]
      flash[:error] = I18n.t('must_select_team')
      return redirect_to teams_path
    end

    team_id = session[:team_id] = params[:team_id]

    @race = Race.find params[:race_id]
    @registration = Registration.new
    # bring in the team's default name
    @registration.name = Team.find(team_id).name
  end

  def create
    return render :status => 400 if params[:registration].blank?

    @race = Race.find params[:race_id]

    @registration = Registration.new registration_params
    @registration.race = @race
    @registration.team = Team.find session[:team_id]

    if @registration.save
      flash.now[:notice] = I18n.t('create_success')
      return redirect_to race_registration_url(@registration.race.id, @registration.id)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @registration.errors.messages
    end
  end

  def show
    @registration = Registration.find params[:id]
    @race = @registration.race
    session[:prior_url] = request.original_url
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    redirect_to teams_path
  end

  alias edit show

  def update
    return render :status => 400 unless params[:registration]
    @registration = Registration.find params[:id]

    if @registration.update_attributes registration_params
      flash[:notice] = I18n.t('update_success')
      return redirect_to race_registration_url(@registration.race.id, @registration.id)
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @registration.errors.messages
    end
    @race = @registration.race
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 400
  end

  def index
    @race = Race.find params[:race_id]
    @registrations = Registration.where :race_id => params[:race_id]
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    render :status => 200
  end

  private

  def registration_params
    params.require(:registration).permit(:name, :description, :twitter)
  end

end
