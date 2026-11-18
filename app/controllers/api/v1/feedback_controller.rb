# Lets a racer, logged in or not, send staff a message along with where they were.
class Api::V1::FeedbackController < Api::V1::BaseController
  MAX_MESSAGE = 5000
  MAX_CONTEXT_VALUE = 500

  # Backed by the Rails cache, so the limit is per dyno unless production gets a shared cache store.
  rate_limit to: 5, within: 1.minute, with: -> { render_errors("rate_limited", status: :too_many_requests) }

  def create
    message = params.expect(:message).to_s.strip
    context = context_params.transform_values { |value| value.to_s.first(MAX_CONTEXT_VALUE) }
    UserMailer.feedback_email(current_user, message.first(MAX_MESSAGE), context, verified_team(context[:team_id])).deliver_now
    render json: {}, status: :created
  end

  private

  # The SPA sends :path, :team_id and :user_agent. Anything else, or a context that is not a hash, is ignored.
  def context_params
    context = params[:context]
    return {} unless context.is_a?(ActionController::Parameters)

    context.permit(:path, :team_id, :user_agent).to_h.symbolize_keys
  end

  # team_id is the client's claim. It is trusted only for the team's owner or staff who may view it.
  def verified_team(team_id)
    team = Team.find_by(id: team_id) if team_id.present?
    team if team && Ability.new(current_user).can?(:show, team)
  end
end
