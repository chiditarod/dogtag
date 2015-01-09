class PasswordResetsController < ApplicationController
  # Method from: http://github.com/binarylogic/authlogic_example/blob/master/app/controllers/application_controller.rb
  before_filter :require_no_user
  before_filter :load_user_using_perishable_token, :only => [ :edit, :update ]

  def new
  end

  def create
    @user = User.find_by_email(params[:email])
    if @user
      @user.deliver_password_reset_instructions!(request.host_with_port)
      flash[:notice] = "Instructions to reset your password have been emailed to you"
      redirect_to home_url
    else
      flash.now[:error] = "No user was found with email address: #{params[:email]}"
      render action: :new, status: 400
    end
  end

  def edit
  end

  def update
    unless params[:password].present? && params[:password_confirmation].present?
      flash[:error] = 'Ensure you supply a new password and confirmation'
      return render :action => :edit
    end

    @user.password = params[:password]
    @user.password_confirmation = params[:password_confirmation]

    # Use @user.save_without_session_maintenance instead if you
    # don't want the user to be signed in automatically.
    if @user.save
      flash[:notice] = "Your password was successfully updated"
      redirect_to user_url(@user.id)
    else
      flash[:error] = @user.errors.messages
      render :action => :edit
    end
  end

  private

  def load_user_using_perishable_token
    @user = User.find_using_perishable_token(params[:id])
    unless @user
      flash[:error] = "We're sorry, but we could not locate your account"
      redirect_to home_url
    end
  end
end
