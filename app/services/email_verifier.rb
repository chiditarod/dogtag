# Checks the SentEmail log for every email a team is expected to have received
# and reports whether each one was delivered.
#
# Emails that would have gone out before tracking started (the earliest
# SentEmail row) have no log row; those are reported as UNTRACKED and do not
# fail the check.
class EmailVerifier
  def initialize(team)
    @team = team
  end

  # => [{ kind: "welcome", status: "delivered" | nil, ok: true | false, untracked: true | false }, ...]
  def report
    @report ||= expected_rows + reminder_rows
  end

  def ok?
    report.all? { |row| row[:ok] }
  end

  # Writes one line per report row: kind, status, OK | UNTRACKED | MISSING | NOT DELIVERED.
  def print_report(io = $stdout)
    report.each do |row|
      io.puts format("%-22s %-12s %s", row[:kind], row[:status] || "-", label_for(row))
    end
  end

  private

  attr_reader :team

  def expected_rows
    kinds = ["welcome"]
    kinds << "team_finalized" if team.finalized
    kinds << "classy_fundraising" if team.finalized && team.race.classy_campaign_id.present?
    kinds.map do |kind|
      email = latest(kind)
      email.nil? && before_tracking?(trigger_time(kind)) ? untracked_row(kind) : row_for(kind, email)
    end
  end

  # When the event that sends this kind of email happened.
  def trigger_time(kind)
    kind == "welcome" ? team.user.created_at : team.notified_at
  end

  def before_tracking?(time)
    tracking_started_at.nil? || time.nil? || time < tracking_started_at
  end

  def tracking_started_at
    return @tracking_started_at if defined?(@tracking_started_at)

    @tracking_started_at = SentEmail.minimum(:created_at)
  end

  def label_for(row)
    return "UNTRACKED" if row[:untracked]
    return "OK" if row[:ok]

    row[:status] ? "NOT DELIVERED" : "MISSING"
  end

  def reminder_rows
    emails.where(kind: "registration_reminder").order(:created_at, :id).map { |email| row_for("registration_reminder", email) }
  end

  def latest(kind)
    scope = kind == "welcome" ? SentEmail.where(user_id: team.user_id) : SentEmail.where(team_id: team.id)
    scope.where(kind: kind).order(:created_at, :id).last
  end

  def emails
    SentEmail.where(team_id: team.id)
  end

  def row_for(kind, email)
    { kind: kind, status: email&.status, ok: ok_status?(email&.status), untracked: false }
  end

  def untracked_row(kind)
    { kind: kind, status: nil, ok: true, untracked: true }
  end

  def ok_status?(status)
    status == "delivered" || (status == "sent" && ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"].blank?)
  end
end
