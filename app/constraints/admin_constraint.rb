# Route constraint that lets only logged-in admins reach the mounted Sidekiq
# dashboard. Anyone else falls through to the catch-all 404.
#
# Reads the Authlogic session (cookie session or remember-me cookie) without
# updating last_request_at, so a visit does not rotate the perishable token.
# Like every other page, it still saves the user when Authlogic resets an
# expired failed-login ban. Single-access tokens (?user_credentials=) are
# refused here even for rss/atom requests, Authlogic's default.
class AdminConstraint
  # Minimal stand-in for a controller, which is what Authlogic's adapter wraps.
  class Controller
    attr_reader :request

    def initialize(request)
      @request = request
    end

    def params = request.params

    def session = request.session

    def cookies = request.cookie_jar

    def last_request_update_allowed? = false

    def single_access_allowed? = false
  end

  def matches?(request)
    previous = Authlogic::Session::Base.controller
    Authlogic::Session::Base.controller = Authlogic::ControllerAdapters::RailsAdapter.new(Controller.new(request))
    UserSession.find&.record&.is?(:admin) == true
  rescue StandardError => e
    Rails.logger.warn("AdminConstraint refused #{request.path}: #{e.class}: #{e.message}")
    false
  ensure
    Authlogic::Session::Base.controller = previous
  end
end
