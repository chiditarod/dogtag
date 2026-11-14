class Api::V1::SessionsController < Api::V1::BaseController
  before_action :require_api_user!, only: :show

  def show
    @user = current_user
    render "api/v1/users/show"
  end

  def create
    # permit (not expect): missing fields must yield 422 login_failed, not 400 ParameterMissing.
    credentials = params.permit(:email, :password, :remember_me).to_h
    credentials[:email] = credentials[:email].to_s.downcase

    # A successful save replaces any existing session cookie; a failed one leaves it untouched.
    session = UserSession.new(credentials)
    if session.save
      @user = session.record
      render "api/v1/users/show"
    else
      render_errors("login_failed")
    end
  end

  def destroy
    # Rotating the persistence token invalidates any replayed copy of the old cookie
    # (signs the user out of all devices).
    current_user&.reset_persistence_token!
    UserSession.find&.destroy
    head :no_content
  end
end
