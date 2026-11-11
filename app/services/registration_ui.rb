# Switches between the legacy server-rendered registration UI and the React SPA.
module RegistrationUi
  # The SPA is used only when it is switched on and can actually be served (built into
  # public/register, or proxied to a Vite dev server), so links never point at a 503.
  def self.spa?
    ENV["REGISTRATION_UI"] == "spa" && (File.exist?(SpaController.index_path) || ENV["VITE_DEV_SERVER"].present?)
  end

  def self.team_url(team)
    return Rails.application.routes.url_helpers.team_url(team, **url_options) unless spa?

    "#{url_options[:protocol] || "http"}://#{url_options.fetch(:host)}/register/teams/#{team.id}"
  end

  def self.url_options = UserMailer.default_url_options
  private_class_method :url_options
end
