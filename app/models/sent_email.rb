# Log of every outgoing email. Rows are created and updated by MailTracking
# (queued -> sent | failed) and used for reminder idempotency via the unique
# partial index on [team_id, kind, dedupe_key]. Mail goes through MXRoute SMTP,
# which has no event webhooks, so delivered/deferred/bounced/dropped/spam_report
# are never set by the app; they are kept for existing data.
class SentEmail < ApplicationRecord
  STATUSES = %w[queued failed sent delivered deferred bounced dropped spam_report].freeze

  KINDS = %w[welcome team_finalized team_waitlisted refund email_changed password_reset classy_fundraising registration_reminder feedback].freeze
  # What the staff filter offers; the unused delivery-event statuses are left out.
  FILTER_STATUSES = %w[sent queued failed].freeze

  # No foreign keys, so a deleted team or user reads as nil.
  belongs_to :team, optional: true
  belongs_to :user, optional: true

  def delivered?
    status == "delivered"
  end
end
