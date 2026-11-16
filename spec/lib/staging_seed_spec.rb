require "spec_helper"

describe StagingSeed do
  let(:env) do
    {
      "SEED_ADMIN_EMAIL" => "staging-admin@example.com",
      "SEED_ADMIN_PASSWORD" => "admin-pass-1234",
      "SEED_PASSWORD" => "seed-pass-1234"
    }
  end

  def run_seed(overrides = {})
    StagingSeed.new(env.merge(overrides)).run
  end

  def team_named(name)
    Team.find_by!(name: name)
  end

  describe "guards" do
    it "refuses to run against the production host" do
      expect { run_seed("APP_HOST" => "dogtag.chiditarod.org") }.to raise_error(StagingSeed::Refused, /production/)
      expect(User.count).to eq(0)
    end

    it "refuses to run with a live Stripe key" do
      expect { run_seed("STRIPE_SECRET_KEY" => "sk_live_abc") }.to raise_error(StagingSeed::Refused, /live Stripe/)
      expect(Race.count).to eq(0)
    end

    it "refuses to run unless the database is empty" do
      FactoryBot.create(:user)
      expect { run_seed }.to raise_error(StagingSeed::Refused, /empty/)
      expect(Race.count).to eq(0)
    end

    it "names each missing required variable" do
      expect { StagingSeed.new(env.except("SEED_PASSWORD")).run }.to raise_error(StagingSeed::Refused, /SEED_PASSWORD/)
      expect { StagingSeed.new(env.except("SEED_ADMIN_EMAIL")).run }.to raise_error(StagingSeed::Refused, /SEED_ADMIN_EMAIL/)
    end
  end

  describe "the seeded data" do
    before { Timecop.freeze(Time.zone.parse("2026-11-16 12:00:00 UTC")) }
    after { Timecop.return }

    it "creates staff accounts that can log in with their roles" do
      run_seed
      admin = User.find_by!(email: "staging-admin@example.com")
      expect(admin.is?(:admin)).to be(true)
      expect(admin.valid_password?("admin-pass-1234")).to be(true)
      expect(User.find_by!(first_name: "Olive").is?(:operator)).to be(true)
      expect(User.find_by!(first_name: "Rene").is?(:refunder)).to be(true)
      expect(User.find_by!(first_name: "Nina").valid_password?("seed-pass-1234")).to be(true)
    end

    it "routes every seeded address to the test mailbox when SEED_EMAIL_BASE is set" do
      run_seed("SEED_EMAIL_BASE" => "tests@mail.test")
      seeded = User.where.not(email: "staging-admin@example.com").pluck(:email) + Person.pluck(:email)
      expect(seeded).to all(match(/\Atests\+seed-[a-z0-9-]+@mail\.test\z/))
      expect(seeded.uniq.size).to eq(seeded.size)
    end

    it "falls back to example.com addresses" do
      run_seed
      expect(Person.pluck(:email)).to all(end_with("@example.com"))
    end

    it "creates an open current race shaped like XXII" do
      run_seed("SEED_CLASSY_CAMPAIGN_ID" => "867400")
      race = Race.find_by!(name: "CHIditarod XXII (staging)")
      expect(race.open_for_registration?).to be(true)
      expect(race.time_zone).to eq("America/Chicago")
      expect(race.people_per_team).to eq(5)
      expect(race.question_fields).to include("racer-type", "agree-to-rules")
      expect(race.classy_campaign_id).to eq(867400)
      expect(race.classy_default_goal).to eq(1500)

      deposit, registration = race.requirements.order(:id).to_a
      expect([deposit.name, deposit.type]).to eq(["Cart Deposit", "PaymentRequirement"])
      expect(deposit.tiers.pluck(:price)).to eq([8800])
      expect(registration.tiers.order(:begin_at).pluck(:price)).to eq([13000, 15000, 17000])
      expect(registration.amount_due_cents).to eq(13000)
    end

    it "covers each team state in XXII" do
      run_seed

      finalized = team_named("Shopping Spree")
      expect(finalized.finalized).to be(true)
      expect(finalized.assigned_team_number).to eq(1)
      expect(finalized.meets_finalization_requirements?).to be(true)
      expect(finalized.money_paid_in_cents).to eq(8800 + 13000)

      half_paid = team_named("Half Paid Haulers")
      expect(half_paid.finalized).to be_falsey
      expect(half_paid.people.count).to eq(5)
      expect(half_paid.completed_questions?).to be(true)
      expect(half_paid.money_paid_in_cents).to eq(8800)

      just_started = team_named("Cart Before the Horse")
      expect(just_started.people.count).to eq(2)
      expect(just_started.jsonform).to be_blank
      expect(just_started.completed_requirements).to be_empty
    end

    it "gives the returning captain past racers from last year's race" do
      run_seed
      rita = User.find_by!(first_name: "Rita")
      past = Race.find_by!(name: "CHIditarod XXI (staging)")
      expect(Race.past).to include(past)
      expect(rita.teams.where(race: past).first.people.count).to eq(5)
      expect(rita.teams.joins(:race).merge(Race.current)).to exist
    end

    it "includes a full race with a waitlisted team, a not-yet-open race and a closed race" do
      run_seed
      full = Race.find_by!(name: "Seed Race: Full")
      expect(full.full?).to be(true)
      expect(full.waitlisted_teams.map(&:name)).to eq(["Waitlist Wagon"])

      expect(Race.find_by!(name: "Seed Race: Opens Soon").not_yet_open?).to be(true)

      closed = Race.find_by!(name: "Seed Race: Closed")
      expect(closed.registration_over?).to be(true)
      expect(Race.current).to include(closed)
    end

    it "uses fake charge ids and sends no email or background jobs" do
      Sidekiq::Worker.clear_all
      expect { run_seed }.not_to change { ActionMailer::Base.deliveries.count }
      expect(Sidekiq::Worker.jobs).to be_empty
      expect(CompletedRequirement.all.map { |cr| cr.metadata["charge_id"] }).to all(start_with("ch_seed_"))
    end
  end
end
