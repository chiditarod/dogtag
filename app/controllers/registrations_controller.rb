class RegistrationsController < ApplicationController
  before_filter :require_user
  respond_to :html

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

    respond_with @registration
  end

  def create
    return render :status => 400 if params[:registration].blank?

    @race = Race.find params[:race_id]

    @registration = Registration.new registration_params
    @registration.race = @race
    @registration.team = Team.find session[:team_id]

    if @registration.save
      flash.now[:notice] = I18n.t('create_success')
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @registration.errors.messages
    end
    respond_with @registration
  end

  def show
    @registration = Registration.find params[:id]
    @race = @registration.race
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



  # todo: not yet customized for this class

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

  # end not yet customized

  private

  def registration_params
    params.require(:registration).permit(:name, :description, :twitter)
  end

end
