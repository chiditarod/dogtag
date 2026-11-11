class Api::V1::PaymentsController < Api::V1::BaseController
  before_action :require_api_user!

  STATUSES = {
    registration_closed: :forbidden,
    already_paid: :conflict,
    in_progress: :conflict,
    race_full: :conflict,
    price_changed: :conflict,
    card_error: :payment_required,
    no_active_tier: :unprocessable_entity,
    wrong_race: :unprocessable_entity,
    not_payable: :unprocessable_entity,
    customer_failed: :unprocessable_entity,
    stripe_error: :bad_gateway,
    unexpected: :bad_gateway
  }.freeze

  def create
    team = Team.includes(:race).find(params[:team_id])
    authorize!(:edit, team)
    requirement_id, stripe_token = params.expect(:requirement_id, :stripe_token)
    requirement = Requirement.find(requirement_id)

    result = Payments::ChargeTeam.call(
      user: current_user,
      team: team,
      requirement: requirement,
      stripe_token: stripe_token,
      stripe_email: params[:stripe_email].presence || current_user.email,
      expected_amount_cents: params[:expected_amount_cents].presence&.to_i
    )

    if result.ok
      team.reload
      render json: { checklist: TeamChecklist.new(team).to_h }, status: :created
    else
      render_errors(result.message, status: STATUSES.fetch(result.error_code))
    end
  end
end
