require "spec_helper"

describe ReminderSelector do
  let(:now) { Time.zone.now.change(usec: 0) }
  let(:race) { FactoryBot.create(:race, registration_open: now - 2.weeks, registration_close: now + 30.days, final_edits_close: now + 40.days, race_datetime: now + 50.days) }
  let!(:team) { FactoryBot.create(:team, race: race) }
  let(:payment) { FactoryBot.create(:payment_requirement, race: race) }

  def due(at = now)
    ReminderSelector.new(now: at).due
  end

  def add_tiers(begin_ats)
    begin_ats.map { |t| FactoryBot.create(:tier, requirement: payment, price: 5000, begin_at: t) }
  end

  around { |ex| Timecop.freeze(now) { ex.run } }

  describe "tier_change" do
    let!(:current_tier) { add_tiers([now - 1.week]).first }

    it "selects tier_change 47h before a tier" do
      upcoming = FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 47.hours)
      reminder = due.find { |r| r.kind == "tier_change" }

      expect(reminder.team).to eq(team)
      expect(reminder.dedupe_key).to eq("tier-#{upcoming.id}-#{upcoming.begin_at.to_i}")
      expect(reminder.details).to include(new_price_cents: 7000, begins_at: upcoming.begin_at)
    end

    it "not 49h before" do
      FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 49.hours)
      expect(due.select { |r| r.kind == "tier_change" }).to be_empty
    end

    it "does not remind teams that already paid" do
      FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 47.hours)
      FactoryBot.create(:completed_requirement, team: team, requirement: payment)
      expect(due.select { |r| r.kind == "tier_change" }).to be_empty
    end

    it "skips a tier that begins at or after registration closes" do
      race.update!(registration_close: now + 20.hours)
      FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 30.hours)
      FactoryBot.create(:tier, requirement: payment, price: 8000, begin_at: now + 20.hours)
      expect(due.map(&:kind)).to eq(["closing_day"])
    end

    it "reminds again when the tier start moves" do
      upcoming = FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 47.hours)
      SentEmail.create!(team_id: team.id, kind: "registration_reminder", dedupe_key: due.first.dedupe_key, status: "sent")
      expect(due).to be_empty

      upcoming.update!(begin_at: now + 46.hours)
      expect(due.map(&:dedupe_key)).to eq(["tier-#{upcoming.id}-#{upcoming.begin_at.to_i}"])
    end
  end

  it "uses the injected clock rather than the real one" do
    add_tiers([now - 1.week])
    upcoming = FactoryBot.create(:tier, requirement: payment, price: 7000, begin_at: now + 10.days)
    expect(due).to be_empty
    expect(due(now + 10.days - 47.hours).map(&:dedupe_key)).to eq(["tier-#{upcoming.id}-#{upcoming.begin_at.to_i}"])
  end

  it "sends no reminders of any kind for waitlisted teams in a full race" do
    race.update!(max_teams: 1, registration_close: now + 23.hours)
    FactoryBot.create(:finalized_team, race: race)
    expect(team.reload.finalized).to be_nil
    expect(due).to be_empty
  end

  describe "closing reminders" do
    it "selects closing_week at 6.5 days" do
      race.update!(registration_close: now + 6.5.days)
      reminder = due.find { |r| r.kind == "closing_week" }
      expect(reminder.team).to eq(team)
      expect(reminder.dedupe_key).to eq("close-7d-#{race.registration_close.to_i}")
      expect(due.map(&:kind)).not_to include("closing_day")
    end

    it "closing_day at 23h" do
      race.update!(registration_close: now + 23.hours)
      reminder = due.find { |r| r.kind == "closing_day" }
      expect(reminder.dedupe_key).to eq("close-24h-#{race.registration_close.to_i}")
      expect(due.map(&:kind)).not_to include("closing_week")
    end

    it "catches up: closing_week is selected with 3 days left, but not again once sent" do
      race.update!(registration_close: now + 3.days)
      reminder = due.first
      expect(reminder.dedupe_key).to eq("close-7d-#{race.registration_close.to_i}")

      SentEmail.create!(team_id: team.id, kind: "registration_reminder", dedupe_key: reminder.dedupe_key, status: "sent")
      expect(due(now + 1.day)).to be_empty
    end

    it "reminds again for a new week when the deadline is extended" do
      race.update!(registration_close: now + 3.days)
      SentEmail.create!(team_id: team.id, kind: "registration_reminder", dedupe_key: due.first.dedupe_key, status: "sent")
      expect(due).to be_empty

      race.update!(registration_close: now + 17.days)
      expect(due(now + 11.days).map(&:dedupe_key)).to eq(["close-7d-#{race.registration_close.to_i}"])
    end

    it "selects nothing between the closing_day and closing_week windows" do
      race.update!(registration_close: now + 36.hours)
      expect(due).to be_empty
    end

    it "selects nothing more than 7 days out" do
      race.update!(registration_close: now + 8.days)
      expect(due).to be_empty
    end
  end

  context "when closing in 23h" do
    before { race.update!(registration_close: now + 23.hours) }

    it "skips finalized teams" do
      team.update_column(:finalized, true)
      expect(due).to be_empty
    end

    it "skips closed races" do
      race.update_columns(registration_close: now - 1.hour)
      expect(due).to be_empty
    end

    it "skips when already sent" do
      SentEmail.create!(team_id: team.id, kind: "registration_reminder", dedupe_key: "close-24h-#{race.registration_close.to_i}", status: "sent")
      expect(due).to be_empty
    end

    it "retries when the earlier attempt failed" do
      key = "close-24h-#{race.registration_close.to_i}"
      SentEmail.create!(team_id: team.id, kind: "registration_reminder", dedupe_key: key, status: "failed")
      expect(due.map(&:dedupe_key)).to eq([key])
    end
  end
end
