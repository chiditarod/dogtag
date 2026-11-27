class Api::V1::QuestionsController < Api::V1::BaseController
  before_action :require_api_user!
  before_action :load_team

  def show
    authorize!(:show, @team)
    render json: { jsonform: parse(@team.race.jsonform, nil) }.merge(saved_payload)
  end

  def update
    authorize!(:edit, @team)
    unless StaffTeamPermissions.questions_open?(@team, current_user)
      raise CanCan::AccessDenied.new(I18n.t("api.errors.registration_closed"))
    end
    return render_errors("no_questions") if @team.race.jsonform.blank?

    answers = params.fetch(:answers, {})
    return render_errors("bad_request", status: :bad_request) unless answers.is_a?(ActionController::Parameters)

    return render_errors("bad_request", status: :bad_request) unless buddy_params_wellformed? && collaborating_wellformed?

    collaborating = params.key?(:collaborating) ? params[:collaborating] : @team.collaborating
    buddy_ids = requested_buddy_ids
    if collaborating != true && sends_picks?(buddy_ids)
      return render_invalid_buddies(collaborating: [I18n.t("api.errors.buddies_need_collaborating")])
    end
    return render_invalid_buddies(buddy_team_ids: [I18n.t("api.errors.invalid_buddies")]) if buddy_ids && !pickable?(buddy_ids)

    # Answering No discards the picks along with it.
    buddy_ids = [] if collaborating == false

    @team.subscribe(TeamAuditor.new)
    saved = Team.transaction do
      @team.collaborating = collaborating
      @team.other_buddies = params[:other_buddies] if params.key?(:other_buddies)
      @team.other_buddies = nil if collaborating == false
      @team.jsonform = JsonForm.filter_answers(@team.race, answers).to_json
      raise ActiveRecord::Rollback unless @team.save

      @team.buddy_team_ids = buddy_ids if buddy_ids
      true
    end

    if saved
      @team.reload
      render json: saved_payload.merge(checklist: TeamChecklist.new(@team, viewer: current_user).to_h)
    elsif @team.errors[:questions].blank? && @team.errors[:other_buddies].present?
      render_invalid_buddies(other_buddies: @team.errors[:other_buddies])
    else
      render json: { error: "invalid_answers", errors: { questions: @team.errors[:questions] } },
             status: :unprocessable_entity
    end
  end

  private

  def load_team
    @team = Team.includes(:race).find(params[:team_id])
  end

  def saved_payload
    {
      answers: parse(@team.jsonform, {}),
      collaborating: @team.collaborating,
      buddy_team_ids: @team.team_buddies.order(:buddy_team_id).pluck(:buddy_team_id),
      other_buddies: @team.other_buddies
    }
  end

  # buddy_team_ids must be an array of integers or numeric strings; other_buddies a string or null.
  def buddy_params_wellformed?
    ids = params[:buddy_team_ids]
    other = params[:other_buddies]
    ids_ok = !params.key?(:buddy_team_ids) || (ids.is_a?(Array) && ids.all? { |id| id.is_a?(Integer) || id.is_a?(String) })
    ids_ok && (other.nil? || other.is_a?(String))
  end

  # collaborating, when sent, must be a JSON true, false or null.
  def collaborating_wellformed?
    !params.key?(:collaborating) || [true, false, nil].include?(params[:collaborating])
  end

  # Non-empty buddy_team_ids or non-blank other_buddies.
  def sends_picks?(buddy_ids)
    buddy_ids.present? || params[:other_buddies].to_s.strip.present?
  end

  # nil when the key is absent (leave the picks alone); otherwise the unique ids (nil for an unparseable one).
  def requested_buddy_ids
    return unless params.key?(:buddy_team_ids)

    params[:buddy_team_ids].map { |id| parse_buddy_id(id) }.uniq
  end

  # Plain decimal digits only: Integer() alone also takes "0x1A", "0b1" and "1_0".
  def parse_buddy_id(id)
    return id if id.is_a?(Integer)

    id.to_s.match?(/\A\d+\z/) ? Integer(id, 10) : nil
  end

  # Picks must be other teams in this team's race; an unparseable (nil) id is never valid.
  def pickable?(ids)
    ids.all? && Team.where(race_id: @team.race_id).where.not(id: @team.id).where(id: ids).count == ids.size
  end

  def render_invalid_buddies(errors)
    render json: { error: "invalid_buddies", errors: errors }, status: :unprocessable_entity
  end

  def parse(json, default)
    json.present? ? JSON.parse(json) : default
  end
end
