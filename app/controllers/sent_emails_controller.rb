class SentEmailsController < ApplicationController
  before_action :require_user

  def index
    authorize! :index, SentEmail

    filters = params.permit(:team_id, :status, :kind, :recipient, :page)
    scope = SentEmail.order(created_at: :desc, id: :desc)
    scope = scope.where(team_id: filters[:team_id]) if filters[:team_id].present?
    scope = scope.where(status: filters[:status]) if filters[:status].present?
    scope = scope.where(kind: filters[:kind]) if filters[:kind].present?
    scope = scope.where("recipient ILIKE ?", "%#{SentEmail.sanitize_sql_like(filters[:recipient])}%") if filters[:recipient].present?
    @sent_emails = scope.page(filters[:page])
  end
end
