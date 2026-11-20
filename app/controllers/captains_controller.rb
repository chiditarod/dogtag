# Legacy (HAML) counterpart of Api::V1::CaptainsController: "Make captain" on the team page.
class CaptainsController < ApplicationController
  before_action :require_user

  def update
    @team = Team.find(params[:team_id])
    person = @team.people.find_by(id: params.expect(:person_id))
    return redirect_to(team_url(id: @team.id), flash: { error: t(".not_on_team") }) unless person

    # The Team update rule: owners only while registration is open, staff any time (same as the API).
    authorize! :update, @team

    # Through the auditor so a team that is otherwise complete finalizes as soon as it has a captain.
    @team.subscribe(TeamAuditor.new)
    if @team.update(captain: person, captain_inferred: nil)
      flash[:notice] = t(".success", name: "#{person.first_name} #{person.last_name}")
    else
      flash[:error] = t("update_failed")
    end
    redirect_to team_url(id: @team.id)
  end
end
