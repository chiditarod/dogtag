# Checks the SentEmail log for every email a team is expected to have received
# and reports whether each one was delivered.
class EmailVerifier
  def initialize(team)
    @team = team
  end

  # => [{ kind: "welcome", status: "delivered" | nil, ok: true | false }, ...]
  def report
    @report ||= expected_rows + reminder_rows
  end

  def ok?
    report.all? { |row| row[:ok] }
  end

  # Writes one line per report row: kind, status, OK | MISSING | NOT DELIVERED.
  def print(io = $stdout)
    report.each do |row|
      label = row[:ok] ? "OK" : (row[:status] ? "NOT DELIVERED" : "MISSING")
      io.puts format("%-22s %-12s %s", row[:kind], row[:status] || "-", label)
    end
  end

  private

  attr_reader :team

  def expected_rows
    kinds = ["welcome"]
    kinds << "team_finalized" if team.finalized
    kinds << "classy_fundraising" if team.finalized && team.race.classy_campaign_id.present?
    kinds.map { |kind| row_for(kind, latest(kind)) }
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
    { kind: kind, status: email&.status, ok: ok_status?(email&.status) }
  end

  def ok_status?(status)
    status == "delivered" || (status == "sent" && ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"].blank?)
  end
end
