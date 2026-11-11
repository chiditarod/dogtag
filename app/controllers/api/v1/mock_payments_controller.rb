# Records a payment without contacting Stripe. Routed only in development and test.
class Api::V1::MockPaymentsController < Api::V1::BaseController
  before_action :require_api_user!

  def create
    team = Team.includes(:race).find(params[:team_id])
    authorize!(:edit, team)
    requirement = Requirement.find(params.expect(:requirement_id))

    return render_errors(I18n.t("charges.wrong_race"), status: :unprocessable_entity) if requirement.race_id != team.race_id
    return render_errors(I18n.t("charges.already_paid"), status: :conflict) if requirement.completed?(team)
    return render_errors("Mock payment declined", status: :payment_required) unless params.fetch(:mock_behavior, "success") == "success"

    amount = requirement.amount_due_cents
    return render_errors(I18n.t("charges.no_active_price"), status: :unprocessable_entity) if amount.nil?

    metadata = { "charge_id" => "mock_ch_#{SecureRandom.hex(12)}", "amount" => amount, "mock" => true }
    return render_errors("Mock payment failed to save") unless requirement.complete(team.id, current_user, metadata)

    team.reload
    render json: { checklist: TeamChecklist.new(team).to_h }, status: :created
  end
end
