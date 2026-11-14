# Records a payment without contacting Stripe. Routed only in development and test.
class Api::V1::MockPaymentsController < Api::V1::BaseController
  before_action :require_api_user!

  def create
    team = Team.includes(:race).find(params[:team_id])
    authorize!(:edit, team)
    requirement = Requirement.find(params.expect(:requirement_id))

    return mock_error(:wrong_race, "wrong_race", :unprocessable_entity) if requirement.race_id != team.race_id
    return mock_error(:already_paid, "already_paid", :conflict) if requirement.completed?(team)
    return mock_error(:card_error, "mock_declined", :payment_required) unless params.fetch(:mock_behavior, "success") == "success"

    amount = requirement.amount_due_cents
    return mock_error(:no_active_tier, "no_active_price", :unprocessable_entity) if amount.nil?

    metadata = { "charge_id" => "mock_ch_#{SecureRandom.hex(12)}", "amount" => amount, "mock" => true }
    return mock_error(:unexpected, "mock_not_saved", :unprocessable_entity) unless requirement.complete(team.id, current_user, metadata)

    team.reload
    render json: { checklist: TeamChecklist.new(team).to_h }, status: :created
  end

  private

  # Same codes as Api::V1::PaymentsController so the SPA handles both alike.
  def mock_error(code, message_key, status)
    render_errors(I18n.t("charges.#{message_key}"), status:, code:)
  end
end
