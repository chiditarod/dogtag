class RacesController < ApplicationController

  respond_to :html

  def show
    begin
      @race = Race.find params[:id]
      respond_with @race
    rescue ActiveRecord::RecordNotFound
      flash[:error] = t('race_not_found')
      return redirect_to races_path
    end
  end

  alias edit show

  def index
    @races = Race.all
  end

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
    begin
      race = Race.find params[:id]
      success = race.update_attributes race_params
      if success
        flash.now[:notice] = t('update_success')
      else
        flash.now[:error] = [t('update_failed')]
        flash.now[:error] << race.errors.messages
      end
      return redirect_to edit_race_path
    rescue ActiveRecord::RecordNotFound
      flash.now[:error] = t('race_not_found')
      return render :status => 400
    end
  end

  private

  def race_params
    params.require(:race).permit(:name, :race_datetime, :max_teams, :racers_per_team)
  end

end
