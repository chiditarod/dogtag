json.sent_emails @sent_emails do |email|
  json.extract! email, :id, :created_at, :kind, :recipient, :subject, :status, :status_changed_at, :error
  json.team email.team && { id: email.team.id, name: email.team.name }
end
json.meta do
  json.page @page
  json.per_page Api::V1::Staff::SentEmailsController::PER_PAGE
  json.total_count @total_count
  json.total_pages (@total_count / Api::V1::Staff::SentEmailsController::PER_PAGE.to_f).ceil
end
json.filters do
  json.team @filter_team_id && { id: @filter_team_id, name: @filter_team&.name }
  json.kinds SentEmail::KINDS
  json.statuses SentEmail::FILTER_STATUSES
end
