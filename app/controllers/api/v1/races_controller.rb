class Api::V1::RacesController < Api::V1::BaseController
  def index
    @races = Race.current.order(:race_datetime).includes(:requirements)
  end

  def show
    @race = Race.find(params[:id])
  end
end
