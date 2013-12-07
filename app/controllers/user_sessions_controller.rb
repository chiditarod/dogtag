class UserSessionsController < ApplicationController
  before_filter :require_no_user, :only => [:new, :create]
  before_filter :require_user, :only => :destroy

  respond_to :html, :json

  # GET /login
  def new
    @user_session = UserSession.new
    respond_with @user_session
  end

  # POST /login
  def create
    @user_session = UserSession.new(params[:user_session])
    if @user_session.save
      flash[:notice] = "Successfully logged in."
      redirect_to users_path, :format => params[:format]
    else
      render :action => 'new', :format => params[:format]
    end
  end

  # DELETE /logout
  def destroy
    @user_session = UserSession.find
    @user_session.destroy
    flash[:notice] = "Successfully logged out."
    redirect_to login_path, :format => params[:format]
  end
end
