# Who is registered for a race: finalized teams, and the teams still registering (or waitlisted
# once the race is full). Any logged-in racer may read it; admins, operators and refunders also
# get per-team staff columns, and admins and operators get the bcc lists.
class Api::V1::RegistrationsController < Api::V1::BaseController
  MAIL_TO = "dogtag@chiditarod.org"
  STAFF_ROLES = %i[admin operator refunder].freeze
  EMAIL_ROLES = %i[admin operator].freeze

  before_action :require_api_user!

  helper_method :answers_for, :payments_paid, :waitlist_positions

  def index
    authorize! :registrations, Race
    @race = Race.includes(:requirements).find(params[:race_id])
    @ability = Ability.new(current_user)
    @staff = current_user.is_any_of?(*STAFF_ROLES)
    @can_email = current_user.is_any_of?(*EMAIL_ROLES)
    @filter_fields = @race.filter_field_array.map { |key| { key:, label: key.tr("-_", "  ").humanize } }
    @enabled_requirement_ids = @race.enabled_requirements.map(&:id)

    teams = @race.teams.includes(:people, :user, :requirements, :completed_requirements).to_a
    @finalized, @registering = teams.partition(&:finalized)
    @finalized.sort_by! { |team| [team.assigned_team_number ? 0 : 1, team.assigned_team_number.to_i, team.id] }
    @full = @finalized.size >= @race.max_teams
    if @full
      @registering.sort_by! { |team| [team.created_at, team.id] }
    else
      @registering.sort_by! { |team| [-team.updated_at.to_f, -team.id] }
    end
  end

  private

  def waitlist_positions
    return {} unless @full

    @registering.each_with_index.to_h { |team, index| [team.id, index + 1] }
  end

  # The team's saved answers for each filter field as display text; {} for a race without
  # filter fields, and nil answers when the stored JSON is unusable.
  def answers_for(team)
    return {} if @filter_fields.empty?

    answers = parse_answers(team.jsonform)
    @filter_fields.to_h { |field| [field[:key], answer_text(answers[field[:key]])] }
  end

  def parse_answers(text)
    parsed = JSON.parse(text.to_s)
    parsed.is_a?(Hash) ? parsed : {}
  rescue JSON::ParserError
    {}
  end

  def answer_text(value)
    case value
    when nil then nil
    when true then "Yes"
    when false then "No"
    when Array then value.map(&:to_s).join(", ").presence
    else value.to_s.presence
    end
  end

  def payments_paid(team)
    team.completed_requirements.count { |cr| @enabled_requirement_ids.include?(cr.requirement_id) && !cr.refunded? }
  end
end
