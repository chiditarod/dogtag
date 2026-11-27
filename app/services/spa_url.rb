# Absolute links into the registration SPA, for emails. The host and protocol come from the mailer's
# default_url_options (APP_HOST), so staging and production each link their own SPA.
module SpaUrl
  BASE_PATH = "/register".freeze

  # `path` must start with "/". `host` overrides the mailer host (the password reset worker passes its own).
  def self.for(path = "/", host: nil)
    options = UserMailer.default_url_options
    "#{options[:protocol] || "http"}://#{host || options.fetch(:host)}#{BASE_PATH}#{path}"
  end
end
