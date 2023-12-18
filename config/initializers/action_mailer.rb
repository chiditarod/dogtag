# action mailer config

if Rails.env.production? || Rails.env.development?
  Rails.application.config.action_mailer.delivery_method = :smtp
  Rails.application.config.action_mailer.perform_deliveries = true
  Rails.application.config.action_mailer.default_options = {from: ENV['DEFAULT_FROM_EMAIL']}
  Rails.application.config.action_mailer.smtp_settings = {
    :address        => ENV['SMTP_HOST'] || '127.0.0.1',
    :port           => ENV['SMTP_PORT'].to_i || 1025,
    :authentication => :plain,
    :user_name      => ENV['SMTP_USERNAME'],
    :password       => ENV['SMTP_PASSWORD'],
    :domain         => ENV['SMTP_DOMAIN'],
    :enable_starttls_auto => true
  }
end
