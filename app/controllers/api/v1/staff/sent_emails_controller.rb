# The staff sent-emails log (operator, admin), filtered like the legacy /sent_emails page.
class Api::V1::Staff::SentEmailsController < Api::V1::Staff::BaseController
  PER_PAGE = 25
  # A page past this is clamped, so a huge page number cannot overflow the OFFSET.
  MAX_PAGE = Users::StaffSearch::MAX_PAGE

  before_action -> { authorize!(:index, SentEmail) }, only: [:index]

  def index
    scope = filtered(SentEmail.all)
    @page = (Integer(params[:page].to_s, 10, exception: false) || 1).clamp(1, MAX_PAGE)
    @total_count = scope.count
    @sent_emails = scope.includes(:team).order(created_at: :desc, id: :desc).limit(PER_PAGE).offset((@page - 1) * PER_PAGE).to_a
    @filter_team_id = team_id
    @filter_team = Team.find_by(id: team_id) if team_id
  end

  private

  def filtered(scope)
    scope = scope.where(team_id: team_id) if team_id
    scope = scope.where(status: params[:status]) if SentEmail::STATUSES.include?(params[:status])
    scope = scope.where(kind: params[:kind]) if params[:kind].is_a?(String) && params[:kind].present?
    recipient = params[:recipient]
    scope = scope.where("recipient ILIKE ?", "%#{SentEmail.sanitize_sql_like(recipient)}%") if recipient.is_a?(String) && recipient.present?
    scope
  end

  # Only a positive integer filters; anything else is ignored.
  def team_id
    return @team_id if defined?(@team_id)

    id = Integer(params[:team_id].to_s, 10, exception: false)
    @team_id = id if id&.positive?
  end
end
