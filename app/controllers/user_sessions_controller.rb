class UserSessionsController < ApplicationController
  before_filter :require_no_user, :only => [:new, :create]
  before_filter :require_user, :only => :destroy

  def new
    @user_session = UserSession.new
  end

  def create
    @user_session = UserSession.new(params[:user_session])
    logger.info params[:user_session]
    if @user_session.save
      flash[:notice] = t('.login_success')
      redirect_back_or_default account_url
    else
      flash[:error] = t('.login_failed')
      render :action => :new
    end
  end

  def destroy
    current_user_session.destroy
    flash[:notice] = t('.logout_success')
    redirect_back_or_default new_user_session_url
  end
end
