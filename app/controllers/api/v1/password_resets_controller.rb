class Api::V1::PasswordResetsController < Api::V1::BaseController
  # Always 202 so the response does not reveal whether an account exists.
  def create
    email = params[:email].to_s.strip.downcase
    # The link host is configured, never taken from the request (Host header poisoning).
    User.find_by(email: email)&.reset_password!(ActionMailer::Base.default_url_options[:host]) if email.present?
    render json: {}, status: :accepted
  end
end
