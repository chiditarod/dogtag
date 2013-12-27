class RacesController < ApplicationController
  before_filter :require_user, :except => [:index, :show]
  respond_to :html

  def index
    @races = Race.find_registerable_races
    @all_races = Race.all
  end

  def show
    @race = Race.find params[:id]
    respond_with @race
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
      flash.now[:notice] = I18n.t('create_success')
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @race.errors.messages
    end
    respond_with @race
  end

  def update
    race = Race.find params[:id]
    if race.update_attributes(race_params)
      flash[:notice] = t('update_success')
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << race.errors.messages
    end
    redirect_to edit_race_path
  rescue ActiveRecord::RecordNotFound
    flash.now[:error] = t('not_found')
    return render :status => 400
  end

  def destroy
    @race = Race.where(:id => params[:id]).first
    return render :status => 400 if @race.nil?

    if @race.destroy
      flash[:notice] = t '.destroy_success'
    else
      flash[:error] = t '.destroy_failed'
    end
    redirect_to races_path
  rescue ActiveRecord::RecordNotFound
    render :status => 400
  end

  private

  def race_params
    params.require(:race).permit(:name, :max_teams, :people_per_team,
                                 :race_datetime, :registration_open, :registration_close)
  end

end
