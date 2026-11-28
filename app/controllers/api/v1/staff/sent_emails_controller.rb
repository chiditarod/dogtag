# The staff sent-emails log (operator, admin), filtered like the legacy /sent_emails page.
#
# - team_id / user_id: the team's or the account's emails (the row's own team_id / user_id, so a user's mail
#   follows the account across email changes). An id that is present but junk, not positive or unknown lists
#   nothing, like the payments list, so a bad link never widens to every email.
# - status, kind: exact; recipient: case-insensitive substring.
class Api::V1::Staff::SentEmailsController < Api::V1::Staff::BaseController
  PER_PAGE = 25
  # A page past this is clamped, so a huge page number cannot overflow the OFFSET.
  MAX_PAGE = 10_000

  before_action -> { authorize!(:index, SentEmail) }, only: [:index]

  def index
    scope = filtered(SentEmail.all)
    @page = (Integer(params[:page].to_s, 10, exception: false) || 1).clamp(1, MAX_PAGE)
    @total_count = scope.count
    @sent_emails = scope.includes(:team).order(created_at: :desc, id: :desc).limit(PER_PAGE).offset((@page - 1) * PER_PAGE).to_a
    @filter_team_id = id_param(:team_id)
    @filter_team = Team.find_by(id: @filter_team_id) if @filter_team_id
    @filter_user_id = id_param(:user_id)
    @filter_user = User.find_by(id: @filter_user_id) if @filter_user_id
  end

  private

  def filtered(scope)
    %i[team_id user_id].each do |key|
      next if params[key].to_s.strip.empty?

      id = id_param(key)
      scope = id&.positive? ? scope.where(key => id) : scope.none
    end
    scope = scope.where(status: params[:status]) if SentEmail::STATUSES.include?(params[:status])
    scope = scope.where(kind: params[:kind]) if params[:kind].is_a?(String) && params[:kind].present?
    recipient = params[:recipient]
    scope = scope.where("recipient ILIKE ?", "%#{SentEmail.sanitize_sql_like(recipient)}%") if recipient.is_a?(String) && recipient.present?
    scope
  end

  # The integer in the param, or nil when it is absent or not an integer.
  def id_param(key)
    Integer(params[key].to_s.strip, 10, exception: false)
  end
end
