class Api::V1::PasswordResetsController < Api::V1::BaseController
  before_action :load_user_from_token, only: [:show, :update]

  # Always 202 so the response does not reveal whether an account exists.
  def create
    email = params[:email].to_s.strip.downcase
    # The link host is configured, never taken from the request (Host header poisoning).
    User.find_by(email: email)&.reset_password!(ActionMailer::Base.default_url_options[:host]) if email.present?
    render json: {}, status: :accepted
  end

  def show
    render json: { email: @user.email }
  end

  # Saving rotates the perishable token, which is what makes the link single use.
  def update
    attrs = params.permit(:password, :password_confirmation)
    %i[password password_confirmation].each { |field| @user.errors.add(field, :blank) if attrs[field].blank? }
    return render_errors(@user) if @user.errors.any?

    if @user.update(attrs)
      # Replaces any session already in this browser, even another user's.
      UserSession.create(@user)
      render "api/v1/users/show"
    else
      render_errors(@user)
    end
  end

  private

  def load_user_from_token
    @user = User.find_using_perishable_token(params[:id])
    render_errors("not_found", status: :not_found) unless @user
  end
end
