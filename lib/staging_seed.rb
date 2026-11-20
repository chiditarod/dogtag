# Small, synthetic data set for the staging app (and handy in development).
# It covers every state the registration flows care about, and contains no real
# racer data. Run it only against an empty database: `bin/rails staging:seed`.
#
# Records are written straight through ActiveRecord with no Wisper listeners and
# no Team#finalize, so seeding sends no email and enqueues no Classy or
# finalizer jobs. Seeded payments carry fake `ch_seed_*` charge ids; refunding
# them through Stripe will fail.
class StagingSeed
  class Refused < StandardError; end

  PRODUCTION_HOST = "dogtag.chiditarod.org"
  ZONE = "America/Chicago"
  EXPERIENCE_LABELS = ["First year", "2 years", "3 years", "4 years", "5+ years"].freeze
  JSONFORM_PATH = Rails.root.join("frontend/src/features/questions/__fixtures__/chiditarod_21.json")
  ANSWERS = {
    "racer-type" => "Racer",
    "theme-chosen" => "Yes",
    "racing-for-time" => "No",
    "explain-theme" => "Supermarket sweep, but for charity.",
    "primary-inspiration" => "Food driving",
    "secondary-inspiration" => "Making a difference",
    "agree-to-core-philosophy" => "Yes",
    "agree-to-rules" => "Yes",
    "agree-to-sabotage" => "Yes",
    "agree-to-cart-deposit" => "Yes",
    "agree-to-cart-food-poundage" => "Yes",
    "agree-not-a-donation" => "Yes",
    "agree-to-orientation" => "Yes",
    "flame-effects" => "No",
    "fundraising" => "Probably",
    "cart-parking" => "Short Term",
    "collaborating" => "No",
    "raced-in-past" => "Yes"
  }.freeze

  def initialize(env = ENV)
    @env = env
    @people_count = 0
  end

  def run
    guard!
    Time.use_zone(ZONE) do
      ActiveRecord::Base.transaction do
        create_staff
        create_captains
        create_past_race
        create_current_race
        create_full_race
        create_opens_soon_race
        create_closed_race
      end
    end
    summary
  end

  private

  attr_reader :env

  def guard!
    if env["APP_HOST"].to_s.downcase == PRODUCTION_HOST
      raise Refused, "refusing to seed the production host #{PRODUCTION_HOST}"
    end
    raise Refused, "refusing to seed with a live Stripe secret key" if env["STRIPE_SECRET_KEY"].to_s.start_with?("sk_live_")

    missing = %w[SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD SEED_PASSWORD].select { |key| env[key].blank? }
    raise Refused, "missing required variables: #{missing.join(', ')}" if missing.any?
    raise Refused, "refusing to seed: the database must be empty (found users or races)" if User.exists? || Race.exists?
  end

  def now = Time.zone.now

  # Every seeded address goes to the test mailbox when SEED_EMAIL_BASE is set,
  # e.g. tests@domain -> tests+seed-rita@domain, so staging mail is never sent
  # to a real person and can be read back.
  def seed_email(slug)
    base = env["SEED_EMAIL_BASE"].presence
    return "seed-#{slug}@example.com" unless base

    user, domain = base.split("@", 2)
    "#{user}+seed-#{slug}@#{domain}"
  end

  def create_user(first, last, slug, roles: [], email: nil, password: env["SEED_PASSWORD"])
    @phone_suffix = (@phone_suffix || 0) + 1
    User.create!(
      first_name: first, last_name: last, email: email || seed_email(slug),
      phone: format("312-555-%04d", @phone_suffix), password: password, password_confirmation: password,
      roles: roles
    )
  end

  def create_staff
    @admin = create_user("Staging", "Admin", "admin", roles: [:admin],
      email: env["SEED_ADMIN_EMAIL"].downcase, password: env["SEED_ADMIN_PASSWORD"])
    create_user("Olive", "Operator", "operator", roles: [:operator])
    create_user("Rene", "Refunder", "refunder", roles: [:refunder])
  end

  def create_captains
    @rita = create_user("Rita", "Returning", "rita")     # past racers + a just-started team
    @frank = create_user("Frank", "Finalized", "frank")  # finalized team
    @paula = create_user("Paula", "Partial", "paula")    # everything but the race fee
    @wally = create_user("Wally", "Waitlist", "wally")   # waitlisted in a full race
    create_user("Nina", "New", "nina")                   # no teams: register from scratch
  end

  CONFIRMATION_TEXT = "See you at the start line! Read the " \
    "[racer guide](https://chiditarod.org) before race day.\n\nQuestions? Reply to this email.".freeze

  # People can only be added while a race is open, so every race is created
  # open and moved to its real dates afterwards with update_columns.
  def open_race(name, people_per_team:, max_teams:, jsonform: nil, classy: false)
    Race.create!(
      name: name, time_zone: ZONE, people_per_team: people_per_team, max_teams: max_teams,
      registration_open: now - 1.day, registration_close: now + 60.days,
      final_edits_close: now + 70.days, race_datetime: now + 80.days,
      experience_labels: EXPERIENCE_LABELS, jsonform: jsonform,
      classy_campaign_id: (env["SEED_CLASSY_CAMPAIGN_ID"].presence&.to_i if classy),
      classy_default_goal: (1500 if classy)
    )
  end

  def payment(race, name, tiers)
    requirement = PaymentRequirement.create!(race: race, name: name)
    tiers.each { |price, begin_at| requirement.tiers.create!(price: price, begin_at: begin_at) }
    requirement
  end

  def team(race, captain, name, people:, answered: false, paid: [], finalized_number: nil)
    team = Team.create!(race: race, user: captain, name: name, description: "#{name}, a staging seed team.",
      experience: 2, jsonform: (ANSWERS.to_json if answered))
    people.times { add_person(team) }
    paid.each do |requirement|
      CompletedRequirement.create!(
        requirement: requirement, team: team, user: captain,
        metadata: JSON.generate("customer_id" => "cus_seed", "charge_id" => "ch_seed_#{SecureRandom.hex(6)}",
          "amount" => requirement.active_tier.price)
      )
    end
    team.update_columns(finalized: true, assigned_team_number: finalized_number, notified_at: now) if finalized_number
    team
  end

  RACER_NAMES = %w[Ada Grace Edsger Barbara Alan Katherine Dennis Frances Ken Radia Linus Margaret Tim Hedy Guido
    Annie Bjarne Lynn Niklaus Sophie Donald Joan John Mary Claude Jean Vint Adele Larry Evelyn].freeze

  def add_person(team)
    @people_count += 1
    first = RACER_NAMES[(@people_count - 1) % RACER_NAMES.size]
    team.people.create!(
      first_name: first, last_name: "Pusher", email: seed_email("racer-#{@people_count}"),
      phone: format("773-555-%04d", @people_count),
      experience: @people_count % 5
    )
  end

  def jsonform
    @jsonform ||= JSONFORM_PATH.read
  end

  # Last year's race, with Rita's five racers (the SPA's past-racer chips).
  def create_past_race
    race = open_race("CHIditarod XXI (staging)", people_per_team: 5, max_teams: 150, jsonform: jsonform)
    deposit = payment(race, "Cart Deposit", [[8800, now - 1.day]])
    fee = payment(race, "Race Registration", [[12000, now - 1.day]])
    team(race, @rita, "Rita's Rollers", people: 5, answered: true, paid: [deposit, fee], finalized_number: 1)
    team(race, @frank, "Aisle Be Back", people: 5, answered: true, paid: [deposit, fee], finalized_number: 2)

    last_year = now - 1.year
    race.update_columns(registration_open: last_year - 80.days, registration_close: last_year - 20.days,
      final_edits_close: last_year - 10.days, race_datetime: last_year)
  end

  # The race people register for on staging: deposit + three tiers, questions.
  def create_current_race
    race = open_race("CHIditarod XXII (staging)", people_per_team: 5, max_teams: 150, jsonform: jsonform, classy: true)
    race.update!(confirmation_text: CONFIRMATION_TEXT)
    deposit = payment(race, "Cart Deposit", [[8800, now - 1.day]])
    fee = payment(race, "Race Registration", [[13000, now - 1.day], [15000, now + 20.days], [17000, now + 40.days]])
    team(race, @frank, "Shopping Spree", people: 5, answered: true, paid: [deposit, fee], finalized_number: 1)
    team(race, @paula, "Half Paid Haulers", people: 5, answered: true, paid: [deposit])
    team(race, @rita, "Cart Before the Horse", people: 2)
  end

  # One spot, already taken: new teams land on the waitlist.
  def create_full_race
    race = open_race("Seed Race: Full", people_per_team: 2, max_teams: 1)
    fee = payment(race, "Race Registration", [[5000, now - 1.day]])
    team(race, @paula, "First Come First Served", people: 2, paid: [fee], finalized_number: 1)
    team(race, @wally, "Waitlist Wagon", people: 1)
  end

  def create_opens_soon_race
    race = open_race("Seed Race: Opens Soon", people_per_team: 3, max_teams: 50)
    payment(race, "Race Registration", [[7500, now - 1.day]])
    race.update_columns(registration_open: now + 10.days, registration_close: now + 40.days,
      final_edits_close: now + 45.days, race_datetime: now + 50.days)
  end

  # Upcoming, but registration has closed and final edits are still open.
  def create_closed_race
    race = open_race("Seed Race: Closed", people_per_team: 3, max_teams: 50)
    payment(race, "Race Registration", [[7500, now - 1.day]])
    race.update_columns(registration_open: now - 30.days, registration_close: now - 2.days,
      final_edits_close: now + 5.days, race_datetime: now + 10.days)
  end

  def summary
    {
      users: User.count, races: Race.count, teams: Team.count, people: Person.count,
      payments: CompletedRequirement.count, admin: @admin.email
    }
  end
end
