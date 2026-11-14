class Api::V1::RacesController < Api::V1::BaseController
  def index
    @races = Race.current.order(:race_datetime).includes(:requirements).to_a
    Race.preload_registration_data(@races)
  end

  def show
    @race = Race.find(params[:id])
  end
end
