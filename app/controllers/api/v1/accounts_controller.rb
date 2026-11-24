class Api::V1::AccountsController < Api::V1::BaseController
  before_action :require_api_user!

  def update
    attrs = params.expect(user: [:first_name, :last_name, :email, :phone, :password, :password_confirmation])

    unless current_user.valid_password?(params[:current_password].to_s)
      current_user.errors.add(:current_password, "is not correct")
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
