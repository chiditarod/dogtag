require "spec_helper"

describe MailTracking do
  let(:deliveries) { ActionMailer::Base.deliveries }

  it "logs a sent welcome email with kind and user" do
    user = FactoryBot.create(:user)
    UserMailer.welcome_email(user).deliver_now
    e = SentEmail.last
    expect([e.kind, e.user_id, e.recipient, e.status]).to eq(["welcome", user.id, user.email, "sent"])
    expect(e.mailer).to eq("UserMailer")
    expect(e.action).to eq("welcome_email")
    expect(e.subject).to eq("Welcome to dogTag")
    expect(e.message_id).to be_present
    expect(e.status_changed_at).to be_present
    expect(JSON.parse(deliveries.last["X-SMTPAPI"].value)).to eq({ "unique_args" => { "sent_email_id" => e.id } })
    expect(deliveries.last["X-Dogtag-Kind"]).to be_nil
    expect(deliveries.last["X-Dogtag-User-Id"]).to be_nil
  end

  it "records team, race and user for team emails" do
    team = FactoryBot.create(:team)
    UserMailer.team_finalized_email(team.user, team).deliver_now
    e = SentEmail.last
    expect([e.kind, e.user_id, e.team_id, e.race_id]).to eq(["team_finalized", team.user.id, team.id, team.race_id])
    expect(deliveries.last["X-Dogtag-Team-Id"]).to be_nil
  end

  it "uses the expected kind for every mailer action" do
    team = FactoryBot.create(:team)
    user = team.user
    UserMailer.team_waitlisted_email(user, team).deliver_now
    UserMailer.classy_fundraising_team_created(user, team).deliver_now
    UserMailer.password_reset_instructions(user, "example.com").deliver_now
    expect(SentEmail.order(:id).pluck(:kind)).to eq(%w[team_waitlisted classy_fundraising password_reset])
  end

  it "joins multiple recipients" do
    message = Mail.new(to: ["a@example.com", "b@example.com"], from: "x@example.com", subject: "s", body: "b")
    message["X-Dogtag-Kind"] = "welcome"
    MailTracking.delivering_email(message)
    expect(SentEmail.last.recipient).to eq("a@example.com, b@example.com")
  end

  it "still delivers the email when tracking fails" do
    user = FactoryBot.create(:user)
    allow(SentEmail).to receive(:create!).and_raise(StandardError, "boom")
    expect { UserMailer.welcome_email(user).deliver_now }.not_to raise_error
    expect(deliveries.count).to eq(1)
    expect(deliveries.last["X-Dogtag-Kind"]).to be_nil
  end
end
