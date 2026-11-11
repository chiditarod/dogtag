# Log of every outgoing email. Rows are created by MailTracking, updated by the
# SendGrid event webhook, and used for reminder idempotency via the unique
# partial index on [team_id, kind, dedupe_key].
class SentEmail < ApplicationRecord
  STATUSES = %w[queued sent delivered deferred bounced dropped spam_report].freeze

  def delivered?
    status == "delivered"
  end
end
