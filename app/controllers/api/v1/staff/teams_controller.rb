# The staff view of one team: who is who, the payments and what this viewer may do (computed on the server).
class Api::V1::Staff::TeamsController < Api::V1::Staff::BaseController
  # Checked before the loader, so a role that may not look learns nothing about which ids exist.
  before_action -> { authorize!(:show, Team) }, only: [:show]
  before_action :load_team, only: [:show]

  def show
    authorize!(:show, @team)
    @can = StaffTeamPermissions.new(@team, current_user).to_h
    @payments = payments
    @sent_emails_count = SentEmail.where(team_id: @team.id).count
  end

  private

  def load_team
    @team = Team.includes(:race, :user, :captain, :buddy_teams, :people).find(params[:id])
  end

  # Payments only (not other requirements), with their status computed in the same query.
  def payments
    @team.completed_requirements
      .joins(:requirement)
      .where(requirements: { type: %w[PaymentRequirement MockPaymentRequirement] })
      .select("completed_requirements.*", "#{CompletedRequirement.payment_status_sql} AS payment_status")
      .preload(:requirement)
      .order("completed_requirements.created_at, completed_requirements.id")
  end
end
