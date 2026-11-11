class Api::V1::PasswordResetsController < Api::V1::BaseController
  # Always 202 so the response does not reveal whether an account exists.
  def create
    email = params[:email].to_s.strip.downcase
    User.find_by(email: email)&.reset_password!(request.host_with_port) if email.present?
    render json: {}, status: :accepted
  end
end
