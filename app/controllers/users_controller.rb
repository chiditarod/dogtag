class UsersController < ApplicationController
  before_filter :require_user, :except => [:new, :create]

  respond_to :html

  def index
    @users = User.all
  end

  def show
    @user = @current_user
  end

  def new
    @user = User.new
  end

  def edit
    @user = User.find(params[:id])
  end

  def create
    @user = User.new user_params
    if @user.save
      flash[:notice] = I18n.t('create_success')
      redirect_back_or_default account_url
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @user.errors.messages
      render :action => :new
    end
  end

  def update
    @user = @current_user
    if @user.update_attributes(user_params)
      flash[:notice] = 'User was successfully updated.'
      redirect_to account_url
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @user.errors.messages
      render :action => :edit
    end
  end

  def destroy
    @user = User.find(params[:id])
    if @user.destroy
      flash[:notice] = 'User was successfully deleted.'
    else
      flash[:error] = 'User could not be deleted.'
    end
    redirect_to users_path
  end

  private

  def user_params
    params.require(:user).permit(:first_name, :last_name, :email, :phone, :password, :password_confirmation)
  end

end
