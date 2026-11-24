module Workers
  # Emails the team's account holder that a payment was refunded. The job carries plain values, not the
  # completed requirement, so it still sends if an admin deletes that row after refunding. The mailer's
  # dedupe key (refund-cr-<id>) means a Sidekiq retry or a second enqueue never sends twice.
  class PaymentRefundedEmail
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :default, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data = {})
      user = User.find(job["user_id"])
      team = Team.find(job["team_id"])
      details = {
        completed_requirement_id: job["completed_requirement_id"],
        requirement_name: job["requirement_name"],
        amount_cents: job["amount_cents"],
        race_name: job["race_name"]
      }
      UserMailer.payment_refunded_email(user, team, details).deliver_now
      log("complete")
    end
  end
end
