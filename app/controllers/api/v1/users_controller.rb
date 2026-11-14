class Api::V1::UsersController < Api::V1::BaseController
  def create
    attrs = params.expect(user: [:first_name, :last_name, :email, :phone, :password, :password_confirmation])
    @user = User.new(attrs)

    if @user.save
      Workers::WelcomeEmail.perform_async({ "user_id" => @user.id })
      UserSession.create(@user)
      render "api/v1/users/show", status: :created
    else
      render_errors(@user)
    end
  end
end
