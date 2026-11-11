# ActionMailer interceptor + observer that logs every outgoing email to
# sent_emails and tags it with a SendGrid correlation id.
#
# Mailers pass context to the interceptor through X-Dogtag-* headers (see
# UserMailer#track). The interceptor reads and strips them so they never leave
# the app. The row id is carried from interceptor to observer on the Mail::Message
# object itself (an instance variable), which is the same object for both
# callbacks within one delivery and is never serialized.
#
# Tracking failures are logged and swallowed; they must never block delivery.
class MailTracking
  HEADERS = {
    team_id: "X-Dogtag-Team-Id",
    user_id: "X-Dogtag-User-Id",
    race_id: "X-Dogtag-Race-Id",
    kind: "X-Dogtag-Kind",
    dedupe_key: "X-Dogtag-Dedupe-Key",
    action: "X-Dogtag-Action"
  }.freeze
  ID_IVAR = :@dogtag_sent_email_id

  def self.delivering_email(message)
    attrs = HEADERS.transform_values { |name| message[name]&.value.presence }
    message.add_message_id if message.message_id.blank?

    sent_email = SentEmail.create!(
      attrs.merge(
        mailer: message.delivery_handler&.name,
        recipient: Array(message.to).join(", "),
        subject: message.subject,
        message_id: message.message_id
      )
    )
    message.instance_variable_set(ID_IVAR, sent_email.id)
    message["X-SMTPAPI"] = { unique_args: { sent_email_id: sent_email.id } }.to_json
  rescue StandardError => e
    Rails.logger.error("MailTracking.delivering_email failed: #{e.class}: #{e.message}")
  ensure
    HEADERS.each_value { |name| message[name] = nil }
  end

  def self.delivered_email(message)
    id = message.instance_variable_get(ID_IVAR)
    return unless id

    SentEmail.where(id: id).update_all(status: "sent", status_changed_at: Time.current, updated_at: Time.current)
  rescue StandardError => e
    Rails.logger.error("MailTracking.delivered_email failed: #{e.class}: #{e.message}")
  end
end
