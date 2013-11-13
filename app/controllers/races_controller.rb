class RacesController < ApplicationController

  respond_to :html

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
      flash[:notice] = I18n.t('.successful_create')
      puts "race saved"
    else
      #flash[:errors] = @race.errors.messages
      puts "race not valid. errors"
      puts @race.errors.messages
    end
    respond_with @race
  end

  private

  def race_params
    params.require(:race).permit(:name, :race_datetime, :max_teams, :racers_per_team)
  end

end
