class Api::V1::BaseController < ActionController::Base
  # Rails reads the token from the X-CSRF-Token header. Authlogic is activated for
  # every ActionController::Base subclass by its Rails railtie (activate_authlogic).
  protect_from_forgery with: :exception

  # Declared first: later (more specific) handlers take precedence.
  rescue_from StandardError do |e|
    raise e unless rescue_unexpected_errors?

    Rails.logger.error("#{e.class}: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
    Rollbar.error(e) if defined?(Rollbar)
    render_errors("server_error", status: :internal_server_error)
  end
  rescue_from ActionDispatch::Http::Parameters::ParseError do |_e|
    render_errors("bad_request", status: :bad_request)
  end
  rescue_from ActiveRecord::RecordInvalid do |e|
    render_errors(e.record)
  end
  rescue_from CanCan::AccessDenied do |e|
    render_errors(e.message.presence || "forbidden", status: :forbidden)
  end
  rescue_from ActiveRecord::RecordNotFound do |_e|
    render_errors("not_found", status: :not_found)
  end
  rescue_from ActionController::ParameterMissing do |e|
    render_errors(e.message, status: :bad_request)
  end
  rescue_from ActionController::InvalidAuthenticityToken do |_e|
    render_errors("invalid_csrf", status: :unprocessable_entity)
  end

  def route_not_found
    render_errors("not_found", status: :not_found)
  end

  private

  # Overridable seam: in development (consider_all_requests_local) let exceptions surface.
  def rescue_unexpected_errors?
    !Rails.configuration.consider_all_requests_local
  end

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = UserSession.find&.record
  end

  def require_api_user!
    render_errors("not_authenticated", status: :unauthorized) unless current_user
  end

  # Owners are only refused an update because registration has closed, so they are told that;
  # anyone else (e.g. a refunder who can view the team) gets CanCan's default message.
  def authorize_update!(subject, team)
    message = I18n.t("api.errors.registration_closed") if team.user_id == current_user.id
    authorize!(:update, subject, message:)
  end

  # Renders { error:, errors: } where errors maps field => [short messages]. When `code` is
  # given it is added as a stable machine-readable key, for errors whose `error` is a sentence.
  def render_errors(record_or_message, status: :unprocessable_entity, code: nil)
    body =
      if record_or_message.respond_to?(:errors)
        { error: "invalid", errors: record_or_message.errors.to_hash.transform_keys(&:to_s) }
      else
        { error: record_or_message.to_s, errors: {} }
      end
    body[:code] = code.to_s if code
    render json: body, status: status
  end
end
