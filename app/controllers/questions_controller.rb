class QuestionsController < ApplicationController
  before_filter :require_user

  respond_to :json, only: [:create]
  respond_to :html, only: [:show]

  # This is a hack to get around strong parameters.
  # These are the names of the parameter keys in the Race's jsonschema.
  # TODO: figure out how to calculate this dynamically.
  HACK_PARAM_WHITELIST = [
    :'racer-type', :'primary-inspiration', :'secondary-inspiration', :'twitter', :'buddies', :'private-comments', :'explain-theme',
    :'agree-to-core-philosophy', :'agree-to-rules', :'agree-to-sabotage', :'agree-to-cart-deposit', :'agree-to-cart-food-poundage',
    :'agree-not-a-donation', :'agree-to-orientation', :'flame-effects', :'fundraising', :'party-bus-interest', :'party-bus-seats'
  ]

  # this method loads the jsonform data from the team's race
  def show
    authorize! :show, :questions
    @team = Team.find params[:team_id]

    unless @team.race.jsonform.present?
      flash[:info] = I18n.t('questions.none_defined')
      return redirect_to team_path(@team)
    end

    # manipulate the jsonform
    jsonform = JSON.parse(@team.race.jsonform)
    jsonform = JsonForm.add_csrf(jsonform, form_authenticity_token)
    jsonform = JsonForm.add_saved_answers(@team, jsonform, form_authenticity_token)
    @questions = jsonform.to_json
  end

  # this saves the team's jsonform response data
  def create
    authorize! :create, :questions
    @team = Team.find(params[:team_id])

    unless @team.race.open_for_registration?
      flash[:error] = I18n.t('questions.cannot_modify')
      return redirect_to team_path(@team)
    end

    @team.jsonform = filter_the_params.to_json

    if @team.save
      flash[:info] = I18n.t('questions.updated')
      redirect_to team_path(@team)
    else
      Rails.logger.error "Issue saving questions for team ID: #{@team.id} with jsonform: #{@team.jsonform}"
      flash[:error] = I18n.t('questions.could_not_save')
      redirect_to team_questions_path(@team)
    end
  end

  private

  # filter the params by the whitelist and remove any with blank values
  # TODO: change this to slice! and reject! after spec'ing
  def filter_the_params
    params
      .slice(*HACK_PARAM_WHITELIST)
      .reject{ |_k,v| v.blank? }
  end

  def question_params
    params
      .require(:team_id)
      .permit(HACK_PARAM_WHITELIST)
  end
end
