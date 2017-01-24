class UsersController < ApplicationController
  before_filter :require_user, :except => [:new, :create]
  load_and_authorize_resource

  def index
    @users = User.all
  end

  def show
    @user = User.find(params[:id] || current_user.id)
  end

  def edit
    @user = User.find(params[:id] || current_user.id)
  end

  def new
    @user = User.new
  end

  def create
    return render :status => 400 if params[:user].blank?

    @user = User.new user_params

    if @user.save
      # todo: move this to an after_create method in the model
      Workers::WelcomeEmail.perform_async({user_id: @user.id})
      flash[:notice] = I18n.t('create_success_user')
      redirect_back_or_default user_url(@user.id)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @user.errors.messages
    end
  end

  def update
    @user = User.find(params[:id])
    try_to_update(@user, user_params, user_url(@user), 'users.update.update_success')
  end

  def destroy
    @user = User.find params[:id]
    try_to_delete(@user, users_path)
  end

  private

  def user_params
    params.require(:user).permit(:first_name, :last_name, :email, :phone, :password, :password_confirmation, :roles => [])
  end
end
