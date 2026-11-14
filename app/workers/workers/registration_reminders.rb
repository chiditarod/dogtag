module Workers
  # Daily job: emails captains whose registration is incomplete when a price
  # tier is about to change or registration is about to close. Idempotent via
  # SentEmail (see ReminderSelector).
  class RegistrationReminders
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :default, retry: false

    def run(job, log = {})
      reminders = ReminderSelector.new.due
      reminders.each { |reminder| deliver(reminder) }
      log("complete", { due: reminders.size })
    end

    private

    def deliver(reminder)
      details = reminder.details.merge(dedupe_key: reminder.dedupe_key)
      UserMailer.registration_reminder(reminder.team, reminder.kind, details).deliver_now
    rescue StandardError => e
      log("error", { team_id: reminder.team.id, kind: reminder.kind, dedupe_key: reminder.dedupe_key }, :error, e)
    end
  end
end
