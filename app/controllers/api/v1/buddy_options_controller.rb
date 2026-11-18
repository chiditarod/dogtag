class Api::V1::BuddyOptionsController < Api::V1::BaseController
  before_action :require_api_user!

  def show
    team = Team.find(params[:team_id])
    authorize!(:edit, team)

    teams = Team.where(race_id: team.race_id)
                .where.not(id: team.id)
                .order(Arel.sql("LOWER(teams.name)"), :id)
                .select(:id, :name, :finalized)
    render json: { teams: teams.map { |t| { id: t.id, name: t.name, finalized: t.finalized == true } } }
  end
end
