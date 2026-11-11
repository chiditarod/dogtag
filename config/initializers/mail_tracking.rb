# Non-reloadable proxy: MailTracking is autoloaded (and reloaded in development),
# so registering the class directly would add a new entry on every reload. This
# module is registered once and resolves MailTracking at call time.
module MailTrackingHook
  def self.delivering_email(message) = MailTracking.delivering_email(message)

  def self.delivered_email(message) = MailTracking.delivered_email(message)
end

ActionMailer::Base.register_interceptor(MailTrackingHook)
ActionMailer::Base.register_observer(MailTrackingHook)
