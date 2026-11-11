Rails.application.config.to_prepare do
  ActionMailer::Base.register_interceptor(MailTracking)
  ActionMailer::Base.register_observer(MailTracking)
end
