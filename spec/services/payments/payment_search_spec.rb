require "spec_helper"

describe Payments::PaymentSearch do
  let!(:race) { FactoryBot.create(:race, name: "Race Open", race_datetime: 6.weeks.from_now) }
  let!(:deposit) { FactoryBot.create(:payment_requirement, name: "Cart Deposit", race: race) }
  let!(:fee) { FactoryBot.create(:payment_requirement, name: "Registration", race: race) }

  def pay(requirement, team_name: "Team #{SecureRandom.hex(3)}", paid_at: Time.current, owner: FactoryBot.create(:user), **attrs)
    team = FactoryBot.create(:team, race: requirement.race, name: team_name, user: owner)
    FactoryBot.create(:completed_requirement, requirement: requirement, team: team, user: owner, created_at: paid_at,
      charge_id: "ch_#{SecureRandom.hex(4)}", amount_cents: 5000, **attrs)
  end

  def search(**params) = described_class.new(**params)

  def ids(**params) = search(**params).payments.map(&:id)

  describe "race" do
    let!(:old_race) { FactoryBot.create(:race, name: "Race Old", race_datetime: 4.weeks.from_now) }
    let!(:old_deposit) { FactoryBot.create(:payment_requirement, race: old_race) }

    it "defaults to the newest open race" do
      mine = pay(deposit)
      pay(old_deposit)

      expect(ids).to eq([mine.id])
      expect(search.filters[:race_id]).to eq(race.id)
    end

    it "prefers the newest open race over a race that has already run" do
      past = FactoryBot.create(:race, name: "Race Past")
      past.update_columns(registration_open: 10.weeks.ago, registration_close: 1.week.ago, race_datetime: 2.days.ago)
      pay(FactoryBot.create(:payment_requirement, race: past))
      mine = pay(deposit)

      expect(ids).to eq([mine.id])
      expect(search.filters[:race_id]).to eq(race.id)
    end

    it "falls back to the most recent race that has already run when none is open" do
      recent = FactoryBot.create(:race, name: "Race Recent")
      recent.update_columns(registration_open: 10.weeks.ago, registration_close: 1.week.ago, race_datetime: 2.days.ago)
      older = FactoryBot.create(:race, name: "Race Older")
      older.update_columns(registration_open: 60.weeks.ago, registration_close: 53.weeks.ago, race_datetime: 1.year.ago)
      upcoming = FactoryBot.create(:race, name: "Race Upcoming")
      upcoming.update_columns(registration_open: 1.week.from_now, registration_close: 9.weeks.from_now, race_datetime: 12.weeks.from_now)
      [race, old_race].each { |r| r.update_columns(registration_close: 3.days.ago, race_datetime: 4.days.from_now) }
      mine = pay(FactoryBot.create(:payment_requirement, race: recent))
      pay(FactoryBot.create(:payment_requirement, race: older))
      pay(FactoryBot.create(:payment_requirement, race: upcoming))

      expect(ids).to eq([mine.id])
      expect(search.filters[:race_id]).to eq(recent.id)
    end

    it "defaults to the newest race when none is open" do
      race.update_columns(registration_close: 1.day.ago)
      old_race.update_columns(registration_close: 2.days.ago)
      mine = pay(deposit)
      pay(old_deposit)

      expect(ids).to eq([mine.id])
    end

    it "lists every race for race_id=all" do
      a = pay(deposit)
      b = pay(old_deposit)

      expect(ids(race_id: "all")).to match_array([a.id, b.id])
      expect(search(race_id: "all").filters[:race_id]).to eq("all")
      expect(search(race_id: "all").filters[:payment_types]).to eq([])
    end

    it "lists nothing for an unknown race id" do
      pay(deposit)

      expect(ids(race_id: "999999")).to be_empty
      expect(search(race_id: "junk").meta[:summary]).to include(count: 0, refunded_count: 0, total_cents: 0)
    end

    it "lists every race, newest first, with its registration status" do
      expect(search.filters[:races]).to eq([
        { id: race.id, name: "Race Open", registration_status: "open" },
        { id: old_race.id, name: "Race Old", registration_status: "open" }
      ])
    end
  end

  describe "payment types" do
    it "offers only the chosen race's payment requirements and filters by one" do
      a = pay(deposit)
      pay(fee)

      expect(search.filters[:payment_types]).to eq([{ id: deposit.id, name: "Cart Deposit" }, { id: fee.id, name: "Registration" }])
      expect(ids(payment_type: deposit.id)).to eq([a.id])
    end
  end

  describe "team" do
    # The default race is `race` (the later one), so the team's own race is never the default.
    let!(:team_race) { FactoryBot.create(:race, name: "Race Team", race_datetime: 4.weeks.from_now) }
    let!(:team_deposit) { FactoryBot.create(:payment_requirement, name: "Team Deposit", race: team_race) }
    let!(:team_fee) { FactoryBot.create(:payment_requirement, name: "Team Fee", race: team_race) }
    let!(:mine_team) { FactoryBot.create(:team, race: team_race, name: "Mine Team") }
    let!(:other_team) { FactoryBot.create(:team, race: team_race, name: "Other Team") }

    def pay_for(team, requirement, **attrs)
      FactoryBot.create(:completed_requirement, requirement: requirement, team: team, user: team.user,
        charge_id: "ch_#{SecureRandom.hex(4)}", amount_cents: 5000, **attrs)
    end

    let!(:mine_deposit) { pay_for(mine_team, team_deposit) }
    let!(:mine_fee) { pay_for(mine_team, team_fee, refunded_at: 1.day.ago) }
    let!(:others) { pay_for(other_team, team_deposit) }
    let!(:elsewhere) { pay(deposit) }

    it "lists only that team's payments in the team's race when no race is given" do
      result = search(team_id: mine_team.id)

      expect(result.payments.map(&:id)).to match_array([mine_deposit.id, mine_fee.id])
      expect(result.filters).to include(
        race_id: team_race.id, team_id: mine_team.id,
        team: { id: mine_team.id, name: "Mine Team", race_id: team_race.id }
      )
      expect(result.filters[:payment_types].map { |type| type[:id] }).to eq([team_deposit.id, team_fee.id])
      expect(result.meta).to include(total_count: 2)
      expect(result.meta[:summary]).to eq(count: 2, refunded_count: 1, total_cents: 10_000, refunded_cents: 5000)
    end

    it "accepts the id as a string and still honors the other filters" do
      expect(ids(team_id: mine_team.id.to_s, payment_type: team_deposit.id)).to eq([mine_deposit.id])
      expect(ids(team_id: mine_team.id, status: "refunded")).to eq([mine_fee.id])
      expect(search(team_id: mine_team.id, payment_type: team_deposit.id).meta[:summary]).to include(count: 1)
    end

    it "lists the team's payments for the team's own race and for every race" do
      expect(ids(team_id: mine_team.id, race_id: team_race.id)).to match_array([mine_deposit.id, mine_fee.id])
      expect(ids(team_id: mine_team.id, race_id: "all")).to match_array([mine_deposit.id, mine_fee.id])
    end

    it "lists nothing when the race is not the team's race" do
      result = search(team_id: mine_team.id, race_id: race.id)

      expect(result.payments).to be_empty
      expect(result.meta[:summary]).to include(count: 0, total_cents: 0)
      expect(result.filters[:team]).to include(id: mine_team.id)
    end

    it "lists nothing for an unknown team id, and says which id it was" do
      result = search(team_id: "999999")

      expect(result.payments).to be_empty
      expect(result.meta).to include(total_count: 0)
      expect(result.meta[:summary]).to include(count: 0, refunded_count: 0, total_cents: 0)
      expect(result.filters).to include(team: nil, team_id: 999_999)
    end

    it "lists nothing for a junk or out-of-range team id, even with a race" do
      %w[abc 1.5 -1 99999999999999999999].each do |junk|
        expect(ids(team_id: junk)).to be_empty
        expect(ids(team_id: junk, race_id: "all")).to be_empty
        expect(ids(team_id: junk, race_id: team_race.id)).to be_empty
      end
      expect(search(team_id: "abc").filters).to include(team: nil, team_id: nil)
    end

    it "does nothing when no team is asked for" do
      expect(search.filters).to include(team: nil, team_id: nil)
      expect(ids(team_id: " ")).to eq([elsewhere.id])
      expect(ids(race_id: "all").size).to eq(4)
    end
  end

  describe "status" do
    it "filters by each status, and all is the default" do
      paid = pay(deposit)
      refunded = pay(deposit, refunded_at: 1.day.ago)
      refunding = pay(deposit)
      FactoryBot.create(:refund_batch_item, completed_requirement: refunding)
      without_charge = pay(deposit, charge_id: nil)

      expect(ids(status: "paid")).to eq([paid.id])
      expect(ids(status: "refunded")).to eq([refunded.id])
      expect(ids(status: "refunding")).to eq([refunding.id])
      expect(ids(status: "not_refundable")).to eq([without_charge.id])
      expect(ids).to match_array([paid, refunded, refunding, without_charge].map(&:id))
      expect(ids(status: "bogus")).to match_array([paid, refunded, refunding, without_charge].map(&:id))
    end

    it "reports each row's status" do
      pay(deposit, refunded_at: 1.day.ago)

      expect(search.payments.first.payment_status).to eq("refunded")
    end
  end

  describe "q" do
    it "matches the team name, payer, owner and racer emails and names, case-insensitively" do
      by_team = pay(deposit, team_name: "The Secret Gentlemen")
      by_owner = pay(deposit, owner: FactoryBot.create(:user, email: "owner.person@fake.com"))
      by_payer = pay(deposit)
      payer = FactoryBot.create(:user, email: "somebody.else@fake.com", first_name: "Paula", last_name: "Payer")
      by_payer.update_columns(user_id: payer.id)
      by_racer = pay(deposit)
      FactoryBot.create(:person, team: by_racer.team, email: "racer.one@example.com", first_name: "Rhonda", last_name: "Racer")

      expect(ids(q: "SECRET gentle")).to eq([by_team.id])
      expect(ids(q: "OWNER.PERSON")).to eq([by_owner.id])
      expect(ids(q: "Somebody.Else")).to eq([by_payer.id])
      expect(ids(q: "paula payer")).to eq([by_payer.id])
      expect(ids(q: "RACER.ONE")).to eq([by_racer.id])
      expect(ids(q: "rhonda racer")).to eq([by_racer.id])
    end

    it "treats % and _ literally" do
      percent = pay(deposit, team_name: "100% Pure")
      pay(deposit, team_name: "100 Pure")
      underscore = pay(deposit, team_name: "a_b")
      pay(deposit, team_name: "axb")

      expect(ids(q: "100%")).to eq([percent.id])
      expect(ids(q: "a_b")).to eq([underscore.id])
    end

    it "lists a payment once however many racers match" do
      cr = pay(deposit)
      FactoryBot.create(:person, team: cr.team, email: "same1@example.com")
      FactoryBot.create(:person, team: cr.team, email: "same2@example.com")

      expect(ids(q: "same")).to eq([cr.id])
    end
  end

  describe "paging" do
    it "pages 25 per page in created_at desc, id desc order" do
      base = Time.utc(2026, 11, 1, 12)
      rows = Array.new(27) { |i| pay(deposit, paid_at: base + i.minutes) }
      tied = pay(deposit, paid_at: base + 26.minutes)
      expected = (rows + [tied]).sort_by { |cr| [cr.created_at, cr.id] }.reverse.map(&:id)

      expect(ids).to eq(expected.first(25))
      expect(ids(page: 2)).to eq(expected.last(3))
      meta = search(page: 2).meta
      expect(meta).to include(page: 2, per_page: 25, total_count: 28, total_pages: 2, refund_batch_limit: 5)
      expect(ids(page: "0")).to eq(expected.first(25))
    end

    it "clamps a huge page instead of failing" do
      pay(deposit)

      huge = search(page: "9" * 30)

      expect(huge.payments).to eq([])
      expect(huge.meta).to include(page: described_class::MAX_PAGE, total_count: 1)
    end
  end

  describe "summary" do
    it "ignores the status filter" do
      pay(deposit)
      pay(deposit, refunded_at: 1.day.ago)
      pay(deposit, refunded_at: 1.day.ago, amount_cents: 2500)

      summary = search(status: "paid").meta[:summary]

      expect(summary).to eq(count: 3, refunded_count: 2, total_cents: 12_500, refunded_cents: 7500)
      expect(search(status: "paid").meta[:total_count]).to eq(1)
    end

    it "follows the other filters" do
      pay(deposit)
      pay(fee, refunded_at: 1.day.ago)

      expect(search(payment_type: fee.id).meta[:summary]).to include(count: 1, refunded_count: 1)
    end
  end

  it "leaves out payments whose team or requirement is gone" do
    kept = pay(deposit)
    orphan = pay(deposit)
    Team.where(id: orphan.team_id).delete_all

    expect(ids).to eq([kept.id])
  end

  it "leaves out requirements that are not payments" do
    other = FactoryBot.create(:requirement, race: race)
    team = FactoryBot.create(:team, race: race)
    FactoryBot.create(:completed_requirement, requirement: other, team: team, charge_id: "ch_x")

    expect(ids).to be_empty
  end
end
