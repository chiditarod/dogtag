# Chooses which of the team's racers is its captain (the person organizers contact).
class Api::V1::CaptainsController < Api::V1::BaseController
  before_action :require_api_user!

  def update
    team = Team.find(params[:team_id])
    authorize!(:show, team)
    authorize_update!(team, team)

    person = team.people.find_by(id: params.expect(:person_id))
    unless person
      message = I18n.t("api.errors.person_not_on_team")
      return render json: { error: message, errors: { person_id: [message] } }, status: :unprocessable_entity
    end

    # Through the auditor so a team that is otherwise complete finalizes as soon as it has a captain.
    team.subscribe(TeamAuditor.new)
    if team.update(captain: person, captain_inferred: nil)
      @team = Team.find(team.id)
      render "api/v1/teams/show"
    else
      render_errors(team)
    end
  end
end
