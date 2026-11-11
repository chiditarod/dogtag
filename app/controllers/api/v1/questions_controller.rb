class Api::V1::QuestionsController < Api::V1::BaseController
  before_action :require_api_user!
  before_action :load_team

  def show
    authorize!(:show, @team)
    render json: { jsonform: parse(@team.race.jsonform, nil), answers: parse(@team.jsonform, {}) }
  end

  def update
    authorize!(:edit, @team)
    unless @team.race.open_for_registration?
      raise CanCan::AccessDenied.new(I18n.t("api.errors.registration_closed"))
    end
    return render_errors("no_questions") if @team.race.jsonform.blank?

    answers = params.fetch(:answers, {})
    return render_errors("bad_request", status: :bad_request) unless answers.is_a?(ActionController::Parameters)

    @team.subscribe(TeamAuditor.new)
    @team.jsonform = JsonForm.filter_answers(@team.race, answers).to_json

    if @team.save
      @team.reload
      render json: { answers: parse(@team.jsonform, {}), checklist: TeamChecklist.new(@team).to_h }
    else
      render json: { error: "invalid_answers", errors: { questions: @team.errors[:questions] } },
             status: :unprocessable_entity
    end
  end

  private

  def load_team
    @team = Team.includes(:race).find(params[:team_id])
  end

  def parse(json, default)
    json.present? ? JSON.parse(json) : default
  end
end
