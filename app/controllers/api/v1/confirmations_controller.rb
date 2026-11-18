# Records that the captain has closed the completion confirmation, so it is shown only once.
class Api::V1::ConfirmationsController < Api::V1::BaseController
  before_action :require_api_user!

  def create
    team = Team.includes(:race).find(params[:team_id])
    authorize!(:show, team)
    # Ownership, not :update, so it still works after registration closes and staff cannot use it up.
    raise CanCan::AccessDenied unless team.user_id == current_user.id

    team.update_column(:confirmation_seen_at, Time.current) if team.confirmation_seen_at.nil?
    render json: { checklist: TeamChecklist.new(team, viewer: current_user).to_h }
  end
end
