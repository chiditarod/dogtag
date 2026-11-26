class Api::V1::AccountsController < Api::V1::BaseController
  before_action :require_api_user!

  def update
    authorize! :update, current_user
    attrs = params.expect(user: [:first_name, :last_name, :email, :phone, :password, :password_confirmation])

    unless current_user.valid_password?(params[:current_password].to_s)
      current_user.errors.add(:current_password, I18n.t("api.errors.current_password_incorrect"))
      return render_errors(current_user)
    end

    # Authlogic ignores a blank password, so a lone confirmation would save as a no-op.
    if attrs[:password].blank? && attrs[:password_confirmation].present?
      current_user.errors.add(:password, :blank)
      return render_errors(current_user)
    end

    if current_user.update(attrs)
      @user = current_user
      render "api/v1/users/show"
    else
      render_errors(current_user)
    end
  end
end
