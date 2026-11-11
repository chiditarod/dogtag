# Switches between the legacy server-rendered registration UI and the React SPA.
module RegistrationUi
  def self.spa?
    ENV["REGISTRATION_UI"] == "spa"
  end

  def self.team_url(team)
    return "https://#{ENV.fetch("APP_HOST")}/register/teams/#{team.id}" if spa?

    Rails.application.routes.url_helpers.team_url(team, **UserMailer.default_url_options)
  end
end
