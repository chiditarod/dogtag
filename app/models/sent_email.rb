# Log of every outgoing email. Rows are created and updated by MailTracking
# (queued -> sent | failed) and used for reminder idempotency via the unique
# partial index on [team_id, kind, dedupe_key]. Mail goes through MXRoute SMTP,
# which has no event webhooks, so delivered/deferred/bounced/dropped/spam_report
# are never set by the app; they are kept for existing data.
class SentEmail < ApplicationRecord
  STATUSES = %w[queued failed sent delivered deferred bounced dropped spam_report].freeze

  def delivered?
    status == "delivered"
  end
end
