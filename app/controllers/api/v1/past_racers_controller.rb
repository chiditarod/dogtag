class Api::V1::PastRacersController < Api::V1::BaseController
  before_action :require_api_user!

  def index
    team = Team.find(params[:team_id])
    authorize!(:show, team)
    @past_racers = PastRacers.new(user: current_user, team: team).call
  end
end
