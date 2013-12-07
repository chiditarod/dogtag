class UsersController < ApplicationController
  before_filter :require_user, :except => [:new, :create]

  respond_to :html, :json

  # GET /users
  def index
    @users = User.all
    respond_with @users
  end

  # GET /users/1
  def show
    @user = User.find(params[:id])
    respond_with @user
  end

  # GET /users/new
  def new
    @user = User.new
    respond_with @user
  end

  # GET /users/1/edit
  def edit
    @user = User.find(params[:id])
  end

  # POST /users
  def create
    @user = User.new user_params


    respond_to do |format|
      if @user.save
        format.html { redirect_to(@user, :notice => 'User was successfully created.') }
        format.json  { render :json => @user, :status => :created, :location => @user }
      else
        format.html { render :action => "new" }
        format.json  { render :json => @user.errors, :status => :unprocessable_entity }
      end
    end
  end

  # PUT /users/1
  def update
    @user = User.find(params[:id])

    respond_to do |format|
      if @user.update_attributes(user_params)
        format.html { redirect_to(@user, :notice => 'User was successfully updated.') }
        format.json  { head :ok }
      else
        format.html { render :action => "edit" }
        format.json  { render :json => @user.errors, :status => :unprocessable_entity }
      end
    end
  end

  # DELETE /users/1
  def destroy
    @user = User.find(params[:id])
    @user.destroy

    respond_to do |format|
      format.html { redirect_to users_path }
      format.json  { head :ok }
    end
  end

  private

  def user_params
    params.require(:user).permit(:first_name, :last_name, :email, :phone, :password, :password_confirmation)
  end

end
