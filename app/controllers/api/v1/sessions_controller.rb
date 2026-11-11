class Api::V1::SessionsController < Api::V1::BaseController
  before_action :require_api_user!, only: :show

  def show
    @user = current_user
    render "api/v1/users/show"
  end

  def create
    UserSession.find&.destroy
    credentials = params.permit(:email, :password, :remember_me).to_h
    credentials[:email] = credentials[:email].to_s.downcase
    session = UserSession.new(credentials)

    if session.save
      @user = session.record
      render "api/v1/users/show"
    else
      render_errors("login_failed")
    end
  end

  def destroy
    UserSession.find&.destroy
    head :no_content
  end
end
