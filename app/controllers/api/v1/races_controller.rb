class Api::V1::RacesController < Api::V1::BaseController
  def index
    @races = Race.current.includes(:requirements).to_a
    Race.preload_registration_data(@races)
    # After the preload: registration_status reads the preloaded finalized-team count.
    @races = @races.sort_by(&:registration_sort_key)
  end

  def show
    @race = Race.find(params[:id])
  end
end
