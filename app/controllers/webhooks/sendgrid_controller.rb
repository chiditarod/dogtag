# Receives SendGrid Signed Event Webhook batches and updates SentEmail.status.
# Deliberately independent of ApplicationController: no session, no CSRF, no auth
# beyond the request signature.
class Webhooks::SendgridController < ActionController::Base
  STATUS_FOR_EVENT = {
    "processed" => "sent",
    "delivered" => "delivered",
    "deferred" => "deferred",
    "bounce" => "bounced",
    "dropped" => "dropped",
    "spamreport" => "spam_report"
  }.freeze

  TERMINAL_STATUSES = %w[delivered bounced dropped spam_report].freeze
  NON_TERMINAL_EVENT_STATUSES = %w[sent deferred].freeze

  skip_forgery_protection
  # The body is read from raw_post; don't also copy it into params.
  wrap_parameters false

  def create
    payload = request.raw_post
    return head :unauthorized unless signature_valid?(payload)

    events = JSON.parse(payload)
    return head :bad_request unless events.is_a?(Array)

    events.each { |event| apply(event) if event.is_a?(Hash) }
    head :ok
  rescue JSON::ParserError
    head :bad_request
  end

  private

  # Event batches arrive as a top-level JSON array (params["_json"]) full of recipient
  # email addresses. Filter it from the "Parameters:" log line for this controller only;
  # an app-wide :_json filter would also partially match other keys.
  def process_action(*)
    filters = Array(request.get_header("action_dispatch.parameter_filter")) + [/\A_json\z/]
    request.set_header("action_dispatch.parameter_filter", filters)
    super
  end

  def signature_valid?(payload)
    SendgridSignature.valid?(
      payload: payload,
      signature: request.headers["X-Twilio-Email-Event-Webhook-Signature"],
      timestamp: request.headers["X-Twilio-Email-Event-Webhook-Timestamp"],
      public_key: ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]
    )
  end

  def apply(event)
    status = STATUS_FOR_EVENT[event["event"]]
    id = Integer(event["sent_email_id"], exception: false)
    return unless status && id

    email = SentEmail.find_by(id: id)
    return unless email
    return if TERMINAL_STATUSES.include?(email.status) && NON_TERMINAL_EVENT_STATUSES.include?(status)
    return if email.status == status

    email.update!(status: status, status_changed_at: Time.current)
  end
end
