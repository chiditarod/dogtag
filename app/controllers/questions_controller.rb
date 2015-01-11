class QuestionsController < ApplicationController
  before_filter :require_user

  respond_to :json, only: [:create]
  respond_to :html, only: [:show]

  def show
    authorize! :show, :questions
    @team = Team.find params[:team_id]

    unless @team
      flash[:error] = I18n.t('team_not_found')
      return redirect_to home_path
    end

    jsonform = @team.race.jsonform

    unless jsonform
      flash[:info] = I18n.t('questions.none_defined')
      return redirect_to team_path(@team)
    end

    if @team.jsonform.present?
      orig = JSON.parse(jsonform)
      new = orig.merge({
        value: JSON.parse(@team.jsonform)
      })
      jsonform = new.to_json
    end

    @questions = jsonform
  end

  def create
    authorize! :create, :questions
    return render :status => 400 if params[:answers].blank?

    @team = Team.find params[:team_id]
    return render :status => 400 unless @team

    answers = params[:answers]
    @team.jsonform = answers.to_json

    json = {
      errors: @team.errors
    }

    # save to team record
    if @team.valid? && @team.save
      render status: 200, json: json
    else
      render status: 400, json: json
    end
  end

  def question_params
    params
      .require(:team_id)
      .permit(:answers)
  end
end
