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
  before_action :require_user
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

  def destroy
    @user = User.find params[:id]
    if (reason = @user.deletion_blocker(by: current_user))
      flash[:error] = reason
      return redirect_to(users_path)
    end

    try_to_delete(@user, users_path)
    # backstop: the guard above catches the known cases, so this only speaks for a delete the database
    # still refuses (a foreign key the guard does not know about)
    flash[:error] = @user.errors.full_messages.to_sentence if flash[:error] && @user.errors.any?
  end

  private

  def index_params
    params.permit(:page)
  end
end
