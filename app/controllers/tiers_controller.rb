# Copyright (C) 2014 Devin Breen
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
class TiersController < ApplicationController
  before_filter :require_user
  load_and_authorize_resource

  def destroy
    @tier = Tier.find(params[:id])
    redirect_url = edit_race_requirement_url(race_id: @tier.requirement.race.id, id: @tier.requirement.id)
    try_to_delete(@tier, redirect_url)
  end

  def update
    @tier = Tier.find(params[:id])
    try_to_update(@tier, tier_params, edit_race_requirement_url(race_id: @tier.requirement.race.id, id: @tier.requirement.id))
  end

  def edit
    @tier = Tier.find(params[:id])
    @requirement = @tier.requirement
  end

  def new
    @requirement = Requirement.find(params[:requirement_id])
    @tier = Tier.new
    @tier.requirement = @requirement
  end

  def create
    begin
      @requirement = Requirement.find(tier_params[:requirement_id])
    rescue ActiveRecord::RecordNotFound
      flash[:error] = t('requirement_not_found')
      return render :status => 400
    end

    @tier = Tier.new(tier_params)
    @tier.requirement = @requirement

    if @tier.save
      flash[:notice] = I18n.t('create_success')
      redirect_to edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id
    else
      flash.now[:error] = [t('create_failed')]
      flash.now[:error] << @tier.errors.messages
    end
  end

  private

  def tier_params
    params.require(:tier).permit(:price, :begin_at, :requirement_id)
  end
end
