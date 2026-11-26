json.batch do
  json.extract! @batch, :id, :created_at, :finished_at, :retry_of_id
  json.reopen @batch.reopen || false
  json.items @batch.items.sort_by(&:id) do |item|
    cr = item.completed_requirement
    json.id item.id
    json.completed_requirement_id item.completed_requirement_id
    json.team_name cr.team.name
    json.payment_type cr.requirement.name
    json.amount_cents cr.amount_cents
    json.status @batch.reported_status(item)
    json.reopened cr.reopened?
    json.extract! item, :error_code, :message, :finished_at
  end
end
