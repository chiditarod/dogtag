# Finds registration reminder emails that are due for unfinalized teams in
# races that are open for registration and not full (teams in a full race are
# waitlisted and are contacted when registration closes). A reminder is skipped once a
# SentEmail exists for its (team, "registration_reminder", dedupe_key) unless
# that delivery failed, in which case it is retried.
class ReminderSelector
  Reminder = Data.define(:team, :kind, :dedupe_key, :details)

  TIER_WINDOW = 48.hours

  def initialize(now: Time.zone.now)
    @now = now
    @full_races = {}
  end

  def due
    teams = Team.all_unfinalized.includes(:completed_requirements, race: { requirements: :tiers })
      .where(race_id: open_races.select(:id))
    reminders = teams.flat_map { |team| reminders_for(team) }
    reminders.reject { |reminder| already_sent?(reminder) }
  end

  private

  attr_reader :now

  def open_races
    Race.where("registration_open <= :now AND registration_close >= :now", now: now)
  end

  def reminders_for(team)
    return [] if full?(team.race)

    [tier_change(team), closing(team)].compact
  end

  def full?(race)
    @full_races.fetch(race.id) { @full_races[race.id] = race.full? }
  end

  def tier_change(team)
    tier = upcoming_tier(team)
    return unless tier

    Reminder.new(
      team: team,
      kind: "tier_change",
      dedupe_key: "tier-#{tier.id}",
      details: { new_price_cents: tier.price, begins_at: tier.begin_at }
    )
  end

  # The soonest tier starting within the window on an enabled (a tier has
  # begun) payment requirement that the team has not already satisfied.
  # Evaluated against the injected clock, not Time.zone.now.
  def upcoming_tier(team)
    paid_ids = team.completed_requirements.map(&:requirement_id)
    team.race.requirements.grep(PaymentRequirement).filter_map do |requirement|
      next if paid_ids.include?(requirement.id) || requirement.tiers.none? { |tier| tier.begin_at < now }

      requirement.tiers.select { |tier| tier.begin_at > now && tier.begin_at <= now + TIER_WINDOW }.min_by(&:begin_at)
    end.min_by(&:begin_at)
  end

  def closing(team)
    close = team.race.registration_close
    if close > now + 2.days && close <= now + 7.days
      Reminder.new(team: team, kind: "closing_week", dedupe_key: "close-7d", details: {})
    elsif close > now && close <= now + 24.hours
      Reminder.new(team: team, kind: "closing_day", dedupe_key: "close-24h", details: {})
    end
  end

  def already_sent?(reminder)
    SentEmail.where(team_id: reminder.team.id, kind: "registration_reminder", dedupe_key: reminder.dedupe_key)
      .where.not(status: "failed").exists?
  end
end
