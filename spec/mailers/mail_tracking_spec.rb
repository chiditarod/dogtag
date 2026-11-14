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
    expect(JSON.parse(deliveries.last["X-SMTPAPI"].value)).to eq({ "unique_args" => { "sent_email_id" => e.id.to_s } })
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

  context "with a dedupe_key" do
    let(:team) { FactoryBot.create(:team) }
    let(:mail) { UserMailer.team_finalized_email(team.user, team) }
    let(:attrs) { { team_id: team.id, kind: "team_finalized", dedupe_key: "once", recipient: team.user.email } }

    before do
      allow_any_instance_of(UserMailer).to receive(:track).and_wrap_original do |m, **kw|
        m.call(**kw, dedupe_key: "once")
      end
    end

    it "suppresses delivery when a non-failed row already exists" do
      existing = SentEmail.create!(attrs.merge(status: "sent"))
      expect { mail.deliver_now }.not_to change { [deliveries.count, SentEmail.count] }
      expect(existing.reload.status).to eq("sent")
    end

    it "reuses a failed row and delivers" do
      existing = SentEmail.create!(attrs.merge(status: "failed", error: "boom"))
      expect { mail.deliver_now }.to change { deliveries.count }.by(1)
      expect(SentEmail.count).to eq(1)
      existing.reload
      expect([existing.status, existing.error]).to eq(["sent", nil])
      expect(JSON.parse(deliveries.last["X-SMTPAPI"].value)).to eq({ "unique_args" => { "sent_email_id" => existing.id.to_s } })
    end

    it "suppresses delivery while a recent row is still queued" do
      SentEmail.create!(attrs.merge(status: "queued"))
      expect { mail.deliver_now }.not_to change { deliveries.count }
    end

    it "reclaims a row abandoned in queued and delivers" do
      existing = SentEmail.create!(attrs.merge(status: "queued", updated_at: 16.minutes.ago))
      expect { mail.deliver_now }.to change { deliveries.count }.by(1)
      expect(SentEmail.count).to eq(1)
      expect(existing.reload.status).to eq("sent")
    end

    it "suppresses delivery when another sender claims the failed row first" do
      existing = SentEmail.create!(attrs.merge(status: "failed"))
      allow(SentEmail).to receive(:find_by!).and_wrap_original do |m, *args|
        m.call(*args).tap { |row| SentEmail.where(id: row.id).update_all(status: "queued", updated_at: Time.current) }
      end

      expect { mail.deliver_now }.not_to change { deliveries.count }
      expect(existing.reload.status).to eq("queued")
    end

    it "suppresses a duplicate sent inside a transaction without breaking it" do
      SentEmail.create!(attrs.merge(status: "sent"))
      SentEmail.transaction do
        expect { mail.deliver_now }.not_to change { deliveries.count }
        expect(SentEmail.count).to eq(1)
      end
    end
  end

  it "marks the row failed with the error and re-raises when delivery raises" do
    user = FactoryBot.create(:user)
    allow_any_instance_of(Mail::TestMailer).to receive(:deliver!).and_raise(IOError, "smtp down")
    expect { UserMailer.welcome_email(user).deliver_now }.to raise_error(IOError, "smtp down")
    e = SentEmail.last
    expect([e.status, e.error]).to eq(["failed", "IOError: smtp down"])
    expect(e.status_changed_at).to be_present
  end
end
