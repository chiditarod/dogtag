class UsersController < ApplicationController
  before_filter :require_user, :except => [:new, :create]

  load_and_authorize_resource

  respond_to :html

  def index
    @users = User.all
  end

  def show
    @user = User.find (params[:id] || current_user.id)
  end

  alias edit show

  def new
    @user = User.new
  end

  def create
    return render :status => 400 if params[:user].blank?

    @user = User.new user_params
    if @user.save
      flash[:notice] = I18n.t('create_success')
      #redirect_to user_url(@user)
      redirect_back_or_default user_url(@user)
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @user.errors.messages
    end
  end

  def update
    return render :status => 400 unless params[:user]

    @user = User.find(params[:id])
    if @user.update_attributes user_params
      flash[:notice] = I18n.t('update_success')
      redirect_to user_url(@user)
    else
      flash.now[:error] = [t('update_failed')]
      flash.now[:error] << @user.errors.messages
    end
  end

  def destroy
    @user = User.find params[:id]
    return render :status => 400 if @user.nil?

    if @user.destroy
      flash[:notice] = t('delete_success')
    else
      flash[:error] = t('delete_failed')
    end
    redirect_to users_path
  end

  private

  def user_params
    params.require(:user).permit(:first_name, :last_name, :email, :phone, :password, :password_confirmation, :roles => [])
  end

  rescue_from ActiveRecord::RecordNotFound do |ex|
    flash.now[:error] = t('not_found')
    render :status => 400
  end

end
