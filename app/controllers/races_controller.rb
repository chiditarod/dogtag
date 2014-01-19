class RacesController < ApplicationController
  before_filter :require_user, :except => [:index, :show]
  load_and_authorize_resource

  def index
    @races = Race.all
    @all_races = Race.all
  end

  def show
    @race = Race.find params[:id]
  rescue ActiveRecord::RecordNotFound
    flash[:error] = t('not_found')
    redirect_to races_path
  end

  alias edit show

  def new
    @race = Race.new
  end

  def create
    return render :status => 400 if params[:race].blank?

    @race = Race.new race_params
    if @race.save
      flash[:notice] = I18n.t('create_success')
      return redirect_to races_path
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @race.errors.messages
    end
  end

  def update
    @race = Race.find params[:id]
    if @race.update_attributes(race_params)
      flash[:notice] = t('update_success')
      return redirect_to race_url(@race)
    else
      flash[:error] = [t('update_failed')]
      flash[:error] << @race.errors.messages
    end
  end

  def destroy
    @race = Race.find params[:id]
    return render :status => 400 if @race.nil?

    if @race.destroy
      flash[:notice] = t '.delete_success'
    else
      flash[:error] = t '.destroy_failed'
    end
    redirect_to races_path
  end

  private

  def race_params
    params.require(:race).permit(:name, :max_teams, :people_per_team,
                                 :race_datetime, :registration_open, :registration_close)
  end

end
