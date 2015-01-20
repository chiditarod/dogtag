class QuestionsController < ApplicationController
  before_filter :require_user

  respond_to :json, only: [:create]
  respond_to :html, only: [:show]

  # This is a hack to get around strong parameters.
  # These are the names of the parameter keys in the Race's jsonschema.
  HACK_PARAMS = [
    :'racer-type', :'primary-inspiration', :'twitter', :'buddies', :'shower-song', :'private-comments',
    :'agree-to-rules', :'agree-to-sabotage', :'agree-to-cart-deposit', :'agree-to-cart-food-poundage',
    :'agree-not-a-donation', :'agree-to-orientation', :'party-bus-interest', :'party-bus-seats'
  ]

  def show
    authorize! :show, :questions
    @team = Team.find params[:team_id]

    unless @team
      flash[:error] = I18n.t('team_not_found')
      return redirect_to home_path
    end

    unless @team.race.jsonform
      flash[:info] = I18n.t('questions.none_defined')
      return redirect_to team_path(@team)
    end

    # manipulate the jsonform
    jsonform = JSON.parse(@team.race.jsonform)

    jsonform = add_csrf(jsonform)
    jsonform = add_saved_answers(jsonform)
    @questions = jsonform.to_json
  end

  def create
    authorize! :create, :questions
    @team = Team.find params[:team_id]
    return render :status => 400 unless @team.present?
    return render :status => 304 unless @team.race.open_for_registration?

    @team.jsonform = get_answer_params.to_json

    # save to team record
    if @team.valid? && @team.save
      flash[:info] = I18n.t('questions.updated')
      redirect_to team_path(@team)
    else
      Rails.logger.error "Issue saving questions for team ID: #{@team.id} with jsonform: #{@team.jsonform}"
      flash[:error] = I18n.t('questions.could_not_save')
      redirect_to team_questions_path(@team)
    end
  end

  private

  def get_answer_params
    params
      .slice(*HACK_PARAMS)
      .reject{ |k,v| v.blank? }
  end

  def add_saved_answers(jsonform)
    # since 'value' will overwrite all defaults, we have to pass csrf here
    auth = {
      'authenticity_token' => form_authenticity_token
    }
    if @team.has_saved_answers?
      jsonform.merge!({
        'value' => JSON.parse(@team.jsonform).merge(auth)
      })
    end
    jsonform
  end

  # Add csrf to JSON schema, which gets passed to the form
  def add_csrf(jsonform)

    form_addition = {
      'type' => 'hidden',
      'key' => 'authenticity_token'
    }
    auth = {
      'type' => 'string',
      'default' => form_authenticity_token
    }

    # add to schema object
    schema = jsonform['schema']['properties']
    schema['authenticity_token'] = auth
    jsonform['schema']['properties'] = schema
    # add to form object
    jsonform['form'] << form_addition
    jsonform
  end

  def question_params
    params
      .require(:team_id)
      .permit(HACK_PARAMS)
  end
end
