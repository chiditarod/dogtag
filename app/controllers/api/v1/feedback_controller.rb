# Lets a racer, logged in or not, send staff a message along with where they were.
class Api::V1::FeedbackController < Api::V1::BaseController
  MAX_MESSAGE = 5000

  rate_limit to: 5, within: 1.minute, with: -> { render_errors("rate_limited", status: :too_many_requests) }

  def create
    message = params.expect(:message).to_s.strip

    context = params.fetch(:context, {}).permit(:path, :team_id, :user_agent).to_h.symbolize_keys
    context = context.transform_values { |v| v.to_s.first(500) }
    UserMailer.feedback_email(current_user, message.first(MAX_MESSAGE), context).deliver_now
    render json: {}, status: :created
  end
end
