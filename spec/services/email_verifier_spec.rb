require "spec_helper"

describe EmailVerifier do
  let(:team) { FactoryBot.create(:team) }
  let(:user) { team.user }
  let(:verifier) { EmailVerifier.new(team) }

  around do |example|
    saved = ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = nil
    example.run
  ensure
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = saved
  end

  def track(kind, status: "sent", **attrs)
    SentEmail.create!({ kind: kind, status: status, mailer: "UserMailer", recipient: "a@b.com" }.merge(attrs))
  end

  def finalize_team
    team.update!(finalized: true, notified_at: Time.current)
  end

  # Marks when tracking started, before the team and user were created.
  before { track("password_reset", created_at: 1.day.ago) }

  def rows
    verifier.report.to_h { |r| [r[:kind], r] }
  end

  it "reports MISSING when finalized email absent" do
    finalize_team
    track("welcome", user_id: user.id)

    expect(rows["team_finalized"]).to eq(kind: "team_finalized", status: nil, ok: false, untracked: false)
    expect(rows["welcome"][:ok]).to be true
    expect(verifier.ok?).to be false
  end

  it "ok when all expected are sent" do
    team.race.update!(classy_campaign_id: 12345)
    finalize_team
    track("welcome", user_id: user.id)
    track("team_finalized", team_id: team.id)
    track("classy_fundraising", team_id: team.id)

    expect(verifier.report.map { |r| r[:kind] }).to eq(%w[welcome team_finalized classy_fundraising])
    expect(verifier.report.map { |r| r[:ok] }).to all(be true)
    expect(verifier.ok?).to be true
  end

  it "only expects welcome for an unfinalized team" do
    team.race.update!(classy_campaign_id: 12345)
    track("welcome", user_id: user.id)

    expect(verifier.report.map { |r| r[:kind] }).to eq(["welcome"])
    expect(verifier.ok?).to be true
  end

  it "reports MISSING classy_fundraising for a finalized team in a Classy race" do
    team.race.update!(classy_campaign_id: 12345)
    finalize_team
    track("welcome", user_id: user.id)
    track("team_finalized", team_id: team.id)

    expect(rows["classy_fundraising"]).to eq(kind: "classy_fundraising", status: nil, ok: false, untracked: false)
    expect(verifier.ok?).to be false
  end

  it "does not expect classy_fundraising for a finalized team in a race without a campaign" do
    team.update!(finalized: true, notified_at: Time.current, classy_id: 99)
    track("welcome", user_id: user.id)
    track("team_finalized", team_id: team.id)

    expect(verifier.report.map { |r| r[:kind] }).to eq(%w[welcome team_finalized])
    expect(verifier.ok?).to be true
  end

  context "when the sendgrid webhook is configured" do
    before { ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = "key" }

    it "requires delivered status" do
      track("welcome", user_id: user.id, status: "sent")
      expect(verifier.ok?).to be false

      SentEmail.where(kind: "welcome").update_all(status: "delivered")
      expect(EmailVerifier.new(team).ok?).to be true
    end
  end

  it "is not ok for bounced or queued rows" do
    track("welcome", user_id: user.id, status: "bounced")
    expect(verifier.ok?).to be false

    SentEmail.where(kind: "welcome").update_all(status: "queued")
    expect(EmailVerifier.new(team).ok?).to be false
  end

  context "for emails that would have been sent before tracking started" do
    before do
      team.race.update!(classy_campaign_id: 12345)
      user.update_columns(created_at: 2.years.ago)
      team.update_columns(finalized: true, notified_at: 2.days.ago)
    end

    it "reports them as UNTRACKED and stays ok" do
      expect(verifier.report.map { |r| [r[:kind], r[:untracked]] })
        .to eq([["welcome", true], ["team_finalized", true], ["classy_fundraising", true]])
      expect(verifier.ok?).to be true

      io = StringIO.new
      verifier.print_report(io)
      expect(io.string.lines.map(&:chomp)).to all(end_with("UNTRACKED"))
    end

    it "still reports a logged row that was not delivered" do
      track("team_finalized", team_id: team.id, status: "bounced")
      expect(rows["team_finalized"]).to include(status: "bounced", ok: false, untracked: false)
      expect(verifier.ok?).to be false
    end
  end

  it "treats everything as UNTRACKED when nothing has been logged yet" do
    SentEmail.delete_all
    expect(verifier.report).to eq([{ kind: "welcome", status: nil, ok: true, untracked: true }])
  end

  it "uses the most recent row per kind" do
    track("welcome", user_id: user.id, status: "bounced", created_at: 2.days.ago)
    track("welcome", user_id: user.id, status: "sent")

    expect(rows["welcome"][:status]).to eq("sent")
  end

  it "adds a row per registration reminder and each must be ok" do
    track("welcome", user_id: user.id)
    track("registration_reminder", team_id: team.id, dedupe_key: "tier-1")
    track("registration_reminder", team_id: team.id, dedupe_key: "close-7d", status: "bounced")

    reminders = verifier.report.select { |r| r[:kind] == "registration_reminder" }
    expect(reminders.map { |r| r[:ok] }).to contain_exactly(true, false)
    expect(verifier.ok?).to be false
  end

  describe "#print_report" do
    it "writes one line per row" do
      finalize_team
      track("welcome", user_id: user.id)
      io = StringIO.new
      verifier.print_report(io)

      lines = io.string.lines.map(&:chomp)
      expect(lines[0]).to eq(format("%-22s %-12s %s", "welcome", "sent", "OK"))
      expect(lines[1]).to eq(format("%-22s %-12s %s", "team_finalized", "-", "MISSING"))
    end

    it "labels non-delivered rows NOT DELIVERED" do
      track("welcome", user_id: user.id, status: "bounced")
      io = StringIO.new
      verifier.print_report(io)

      expect(io.string).to include("NOT DELIVERED")
    end
  end
end
