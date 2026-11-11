# Copyright (C) 2015 Devin Breen
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
class QuestionsController < ApplicationController
  before_action :require_user

  respond_to :json, only: [:create]
  respond_to :html, only: [:show]

  # this method loads the jsonform data from the team's race
  def show
    authorize! :show, :questions
    @team = Team.find params[:team_id]
    authorize! :show, @team

    unless @team.race.jsonform.present?
      flash[:info] = I18n.t('questions.none_defined')
      return redirect_to team_path(@team)
    end

    jsonform = JSON.parse(@team.race.jsonform)
    jsonform = JsonForm.add_csrf(jsonform, form_authenticity_token)
    jsonform = JsonForm.add_saved_answers(@team, jsonform, form_authenticity_token)
    @questions = jsonform.to_json
  end

  # this saves the team's jsonform response data
  def create
    authorize! :create, :questions
    @team = Team.find(params[:team_id])
    authorize! :edit, @team

    # todo: move this validation logic into model
    unless @team.race.open_for_registration?
      flash[:error] = I18n.t('questions.cannot_modify')
      return redirect_to team_path(@team)
    end

    @team.jsonform = JsonForm.filter_answers(@team.race, params).to_json

    if @team.save
      flash[:info] = I18n.t('questions.updated')
      redirect_to team_path(@team)
    else
      Rails.logger.error "Issue saving questions for team ID: #{@team.id} with jsonform: #{@team.jsonform}"
      flash[:error] = I18n.t('questions.could_not_save')
      redirect_to team_questions_path(@team)
    end
  end
end
