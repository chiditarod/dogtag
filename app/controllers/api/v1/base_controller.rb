class Api::V1::BaseController < ActionController::Base
  # Rails reads the token from the X-CSRF-Token header. Authlogic is activated for
  # every ActionController::Base subclass by its Rails railtie (activate_authlogic).
  protect_from_forgery with: :exception

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

  private

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = UserSession.find&.record
  end

  def require_api_user!
    render_errors("not_authenticated", status: :unauthorized) unless current_user
  end

  # Renders { error:, errors: } where errors maps field => [short messages].
  def render_errors(record_or_message, status: :unprocessable_entity)
    body =
      if record_or_message.respond_to?(:errors)
        { error: "invalid", errors: record_or_message.errors.to_hash.transform_keys(&:to_s) }
      else
        { error: record_or_message.to_s, errors: {} }
      end
    render json: body, status: status
  end
end
