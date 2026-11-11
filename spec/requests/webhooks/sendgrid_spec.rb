require "spec_helper"

describe "POST /webhooks/sendgrid" do
  let(:key) { OpenSSL::PKey::EC.generate("prime256v1") }
  let(:timestamp) { "1700000000" }
  let!(:email) { SentEmail.create!(mailer: "UserMailer", recipient: "a@b.com", kind: "welcome", status: "sent") }

  around do |example|
    saved = ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = Base64.strict_encode64(key.public_to_der)
    example.run
  ensure
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = saved
  end

  def post_events(events, signed: true, signing_key: key)
    body = events.to_json
    headers = { "CONTENT_TYPE" => "application/json" }
    if signed
      signature = Base64.strict_encode64(signing_key.sign(OpenSSL::Digest::SHA256.new, timestamp + body))
      headers["X-Twilio-Email-Event-Webhook-Signature"] = signature
      headers["X-Twilio-Email-Event-Webhook-Timestamp"] = timestamp
    end
    post "/webhooks/sendgrid", params: body, headers: headers
  end

  it "returns 401 and changes nothing when unsigned" do
    post_events([{ event: "delivered", sent_email_id: email.id }], signed: false)

    expect(response).to have_http_status(:unauthorized)
    expect(email.reload.status).to eq("sent")
  end

  it "returns 401 when signed with the wrong key" do
    post_events([{ event: "delivered", sent_email_id: email.id }], signing_key: OpenSSL::PKey::EC.generate("prime256v1"))

    expect(response).to have_http_status(:unauthorized)
    expect(email.reload.status).to eq("sent")
  end

  it "returns 401 when the public key is not configured" do
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = nil
    post_events([{ event: "delivered", sent_email_id: email.id }])

    expect(response).to have_http_status(:unauthorized)
    expect(email.reload.status).to eq("sent")
  end

  it "updates status from a signed delivered event" do
    post_events([{ event: "delivered", sent_email_id: email.id }])

    expect(response).to have_http_status(:ok)
    expect(email.reload.status).to eq("delivered")
    expect(email.status_changed_at).to be_present
  end

  it "accepts sent_email_id as a string" do
    post_events([{ event: "bounce", sent_email_id: email.id.to_s }])

    expect(email.reload.status).to eq("bounced")
  end

  it "maps every event type" do
    { "processed" => "sent", "deferred" => "deferred", "bounce" => "bounced",
      "dropped" => "dropped", "spamreport" => "spam_report", "delivered" => "delivered" }.each do |event, status|
      email.update!(status: "queued")
      post_events([{ event: event, sent_email_id: email.id }])
      expect(email.reload.status).to eq(status)
    end
  end

  it "is idempotent when an event is replayed" do
    2.times { post_events([{ event: "delivered", sent_email_id: email.id }]) }

    expect(response).to have_http_status(:ok)
    expect(email.reload.status).to eq("delivered")
  end

  it "does not downgrade a terminal status to deferred or sent" do
    email.update!(status: "delivered")
    post_events([{ event: "deferred", sent_email_id: email.id }, { event: "processed", sent_email_id: email.id }])

    expect(response).to have_http_status(:ok)
    expect(email.reload.status).to eq("delivered")
  end

  it "lets a later delivered event overwrite an app-side failed status" do
    email.update!(status: "failed")
    post_events([{ event: "delivered", sent_email_id: email.id }])

    expect(email.reload.status).to eq("delivered")
  end

  it "returns 200 for unknown ids, unknown events, and missing ids" do
    post_events([{ event: "delivered", sent_email_id: 0 }, { event: "open", sent_email_id: email.id }, { event: "delivered" }])

    expect(response).to have_http_status(:ok)
    expect(email.reload.status).to eq("sent")
  end

  it "returns 400 for a signed body that is not a JSON array" do
    body = "nope"
    signature = Base64.strict_encode64(key.sign(OpenSSL::Digest::SHA256.new, timestamp + body))
    post "/webhooks/sendgrid", params: body, headers: { "X-Twilio-Email-Event-Webhook-Signature" => signature, "X-Twilio-Email-Event-Webhook-Timestamp" => timestamp }

    expect(response).to have_http_status(:bad_request)
  end
end
