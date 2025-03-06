# Copyright (C) 2013 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class UsersController < ApplicationController
  before_action :require_user, except: [:new, :create]
  before_action :set_no_cache, only: %w{search}
  load_and_authorize_resource

  def search
    if params[:q].present?
      query = params[:q]
      @users = User.where('first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?', "%#{query.parameterize}%", "%#{query.parameterize}%", "%#{query}%")
    else
      @users = User.none
    end

    respond_to do |format|
      format.json { render json: @users.map { |user| { id: user.id, text: "#{user.first_name} #{user.last_name} (#{user.email})" } } }
    end
  end

  def index
    @users = User.page(index_params[:page])
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
    return render :status => :bad_request if params[:user].blank?

    @user = User.new user_params

    if @user.save
      # todo: move this to an after_create method in the model
      Workers::WelcomeEmail.perform_async({'user_id' => @user.id})
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

  def index_params
    params.permit(:page)
  end
end
