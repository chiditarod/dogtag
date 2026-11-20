# Rake task to seed test data for integration tests
# Usage:
#   rails test_seeds:admin                     (create admin user only)
#   rails test_seeds:operator                  (create operator user only; the e2e staff login)
#   rails test_seeds:basic                     (create full test environment using factories)
#   rails test_seeds:payment_tiers             (create payment tiers test data)
#   rails test_seeds:stripe_payment            (create Stripe payment test data)
#   rails test_seeds:user_registration         (generate credentials for registration test)
#   rails test_seeds:password_reset            (create user for password reset test)
#   rails test_seeds:password_reset_token      (generate perishable token for password reset)
#   rails test_seeds:past_racers               (captain with a 2025 team and an empty current team)
#   rails test_seeds:racer_details             (captain with a racer on the roster and one past racer at 7 years)
#   rails test_seeds:reminder                  (race closing in 23h with an unfinalized team)
#   rails test_seeds:buddy_picker              (captain's team, same-route question unanswered, plus two other teams in a race with questions)
#   rails test_seeds:show_when                 (captain's team in a race whose form has a showWhen field)
#   rails test_seeds:race_list_order           (open, waitlist, registration-over and not-yet-open races; a captain with teams in two of them)
#   rails test_seeds:team_captain             (captain's team with two racers and no team captain chosen)
#   rails test_seeds:cleanup                   (clean up all test data)
#
# All tasks abort in production unless ALLOW_TEST_SEEDS_IN_PRODUCTION=true.

namespace :test_seeds do
  # Every task here creates fake data or (cleanup) deletes by name/email pattern,
  # so refuse to run in production unless explicitly allowed.
  desc "Abort when running in production (set ALLOW_TEST_SEEDS_IN_PRODUCTION=true to override)"
  task :guard do
    if Rails.env.production? && ENV["ALLOW_TEST_SEEDS_IN_PRODUCTION"] != "true"
      abort "test_seeds tasks create and delete data by pattern and are disabled in production. " \
            "Set ALLOW_TEST_SEEDS_IN_PRODUCTION=true to run them deliberately."
    end
  end

  desc "Create admin user only (static email)"
  task admin: [:guard, :environment] do
    puts "🌱 Creating admin user..."

    # Only create if doesn't exist
    admin = User.find_by(email: "test+admin@example.com")
    if admin
      puts "  Admin user already exists: #{admin.email}"
    else
      admin = User.create!(
        first_name: "Admin",
        last_name: "User",
        email: "test+admin@example.com",
        phone: "555-111-2222",
        password: "password123",
        password_confirmation: "password123",
        roles_mask: User.mask_for(:admin)
      )
      puts "  ✓ Admin user created: #{admin.email}"
    end
  end

  desc "Create operator user only (static email; the staff login for the registration e2e suite)"
  task operator: [:guard, :environment] do
    puts "🌱 Creating operator user..."

    operator = User.find_by(email: "test+operator@example.com")
    if operator
      puts "  Operator user already exists: #{operator.email}"
    else
      operator = User.create!(
        first_name: "Operator",
        last_name: "User",
        email: "test+operator@example.com",
        phone: "555-111-3333",
        password: "password123",
        password_confirmation: "password123",
        roles_mask: User.mask_for(:operator)
      )
      puts "  ✓ Operator user created: #{operator.email}"
    end
  end

  desc "Create basic test environment using factories: captain, race, team with 4 people"
  task basic: [:guard, :environment] do
    require 'factory_bot_rails'
    require 'json'
    require 'securerandom'

    puts "🌱 Seeding basic test environment using factories..."

    # Generate unique ID for credentials file (must be passed from Playwright for concurrency)
    unique_id = ENV['TEST_UNIQUE_ID'] || SecureRandom.uuid
    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")

    # Create captain user with known password
    puts "  Creating team captain user..."
    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "TestUser",
      email: "captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    puts "    ✓ Captain created: #{captain.email}"

    # Create race open for registration with 5 people per team
    puts "  Creating open race..."
    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 5,
      max_teams: 100
    )
    puts "    ✓ Race created: #{race.name}"
    puts "      - Open for registration: #{race.registration_open} to #{race.registration_close}"
    puts "      - People per team: #{race.people_per_team}"

    # Create team with 4 people (needs 5 to finalize)
    puts "  Creating team with 4 people..."
    team = FactoryBot.create(:team,
      name: "Test Team Awesome",
      description: "A test team ready for one more member!",
      experience: 1,
      race: race,
      user: captain
    )

    # Add 4 people to the team
    4.times do |i|
      person = FactoryBot.create(:person,
        team: team,
        # The first racer is the account holder, so the team gets a captain and can finalize.
        email: i.zero? ? captain.email : "person#{i + 1}-#{unique_id}@example.com"
      )
      puts "    ✓ Added person #{i + 1}: #{person.first_name} #{person.last_name} (#{person.email})"
    end

    puts "    Team status: #{team.people.count}/#{race.people_per_team} people"
    puts "    Finalized: #{team.finalized.inspect} (needs #{race.people_per_team - team.people.count} more)"

    # Write credentials to unique temp file for Playwright tests
    credentials = {
      captain_email: captain.email,
      captain_password: "password123",
      race_id: race.id,
      race_name: race.name,
      team_id: team.id,
      team_name: team.name
    }
    File.write(credentials_file, credentials.to_json)

    puts ""
    puts "✅ Test environment seeded successfully!"
    puts ""
    puts "📋 Summary:"
    puts "  Captain user: #{captain.email} / password123"
    puts "  Race: #{race.name} (ID: #{race.id})"
    puts "  Team: #{team.name} (ID: #{team.id})"
    puts "  Team status: #{team.people.count}/#{race.people_per_team} people (needs 1 more to finalize)"
    puts "  Credentials file: #{credentials_file}"
    puts ""
    puts "🧪 Ready for integration tests!"
  end

  desc "Create race with 2 payment requirements (1 tier and 3 tiers) using factories"
  task payment_tiers: [:guard, :environment] do
    require 'factory_bot_rails'
    require 'json'
    require 'securerandom'

    puts "🌱 Seeding payment tiers test using factories..."

    # Generate unique ID for credentials file (must be passed from Playwright for concurrency)
    unique_id = ENV['TEST_UNIQUE_ID'] || SecureRandom.uuid
    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")

    # Create captain with known password
    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Tester",
      email: "captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    # Create race
    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 5,
      max_teams: 100
    )

    # Payment requirement #1: Single tier (mock success)
    pr1 = MockPaymentRequirement.create!(
      name: "Registration Fee",
      race: race
    )
    Tier.create!(
      requirement: pr1,
      price: 5000, # $50.00
      begin_at: 10.days.ago
    )

    # Payment requirement #2: 3 tiers (tier 2 is active, mock success)
    pr2 = MockPaymentRequirement.create!(
      name: "Team Fee",
      race: race
    )
    Tier.create!(requirement: pr2, price: 4000, begin_at: 10.days.ago) # Early: $40
    Tier.create!(requirement: pr2, price: 5000, begin_at: 1.day.ago)  # Active: $50
    Tier.create!(requirement: pr2, price: 6000, begin_at: 10.days.from_now) # Late: $60

    # Create team with 5 people using factory
    team = FactoryBot.create(:team,
      name: "Test Team Payment",
      description: "Test team for payment tiers",
      experience: 1,
      race: race,
      user: captain
    )

    5.times do |i|
      FactoryBot.create(:person,
        team: team,
        # The first racer is the account holder, so the team gets a captain and can finalize.
        email: i.zero? ? captain.email : "person#{i + 1}-#{unique_id}@example.com"
      )
    end

    # Write credentials to unique temp file for Playwright tests
    credentials = {
      captain_email: captain.email,
      captain_password: "password123",
      race_id: race.id,
      race_name: race.name,
      team_id: team.id,
      team_name: team.name
    }
    File.write(credentials_file, credentials.to_json)

    puts "✅ Seeded!"
    puts "  Captain: #{captain.email} / password123"
    puts "  Race: #{race.name} (ID: #{race.id})"
    puts "  Team: #{team.name} (ID: #{team.id})"
    puts "  Payment #1: #{pr1.name} - 1 tier ($50)"
    puts "  Payment #2: #{pr2.name} - 3 tiers (tier 2 active: $50)"
    puts "  Credentials file: #{credentials_file}"
  end

  desc "Create team with 5 people and 1 real Stripe payment requirement"
  task stripe_payment: [:guard, :environment] do
    require 'factory_bot_rails'
    require 'json'
    require 'securerandom'

    puts "🌱 Seeding Stripe payment test using factories..."

    # Generate unique ID for credentials file (must be passed from Playwright for concurrency)
    unique_id = ENV['TEST_UNIQUE_ID'] || SecureRandom.uuid
    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")

    # Create captain with known password
    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Stripe",
      email: "captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    # Create race
    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 5,
      max_teams: 100
    )

    # Create real PaymentRequirement (connects to Stripe)
    payment_req = PaymentRequirement.create!(
      name: "Registration Fee",
      race: race
    )
    Tier.create!(
      requirement: payment_req,
      price: 5000, # $50.00
      begin_at: 10.days.ago
    )

    # Create team with 5 people using factory
    team = FactoryBot.create(:team,
      name: "Test Team Stripe",
      description: "Test team for Stripe payments",
      experience: 1,
      race: race,
      user: captain
    )

    5.times do |i|
      FactoryBot.create(:person,
        team: team,
        # The first racer is the account holder, so the team gets a captain and can finalize.
        email: i.zero? ? captain.email : "person#{i + 1}-#{unique_id}@example.com"
      )
    end

    # Write credentials to unique temp file for Playwright tests
    credentials = {
      captain_email: captain.email,
      captain_password: "password123",
      race_id: race.id,
      race_name: race.name,
      team_id: team.id,
      team_name: team.name,
      payment_amount: 5000
    }
    File.write(credentials_file, credentials.to_json)

    puts "✅ Seeded!"
    puts "  Captain: #{captain.email} / password123"
    puts "  Race: #{race.name} (ID: #{race.id})"
    puts "  Team: #{team.name} (ID: #{team.id})"
    puts "  Team members: 5/5 (full team)"
    puts "  Payment: #{payment_req.name} - $50.00 (real Stripe)"
    puts "  Credentials file: #{credentials_file}"
  end

  desc "Create user for password reset test"
  task password_reset: [:guard, :environment] do
    require 'factory_bot_rails'
    require 'json'
    require 'securerandom'

    puts "🌱 Seeding password reset test..."

    # Generate unique ID for credentials file (must be passed from Playwright for concurrency)
    unique_id = ENV['TEST_UNIQUE_ID'] || SecureRandom.uuid
    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")

    # Create user with known password
    user = FactoryBot.create(:user,
      first_name: "Reset",
      last_name: "TestUser",
      email: "reset-#{unique_id}@example.com",
      password: "oldpassword123",
      password_confirmation: "oldpassword123"
    )

    # Write credentials to unique temp file for Playwright tests
    credentials = {
      user_email: user.email,
      old_password: "oldpassword123",
      new_password: "newpassword456",
      user_id: user.id
    }
    File.write(credentials_file, credentials.to_json)

    puts "✅ Seeded!"
    puts "  User: #{user.email} / oldpassword123"
    puts "  Credentials file: #{credentials_file}"
  end

  desc "Generate perishable token for password reset test"
  task password_reset_token: [:guard, :environment] do
    require 'json'

    unique_id = ENV['TEST_UNIQUE_ID']
    unless unique_id
      puts "ERROR: TEST_UNIQUE_ID environment variable required"
      exit 1
    end

    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")
    credentials = JSON.parse(File.read(credentials_file))

    user = User.find_by(email: credentials['user_email'])
    unless user
      puts "ERROR: User not found: #{credentials['user_email']}"
      exit 1
    end

    # Reset the perishable token to get a fresh one
    user.reset_perishable_token!

    # Update credentials with token
    credentials['perishable_token'] = user.perishable_token
    File.write(credentials_file, credentials.to_json)

    puts "✅ Perishable token generated: #{user.perishable_token}"
  end

  desc "Create credentials for user registration test (no database seeding needed)"
  task user_registration: [:guard, :environment] do
    require 'json'
    require 'securerandom'

    puts "🌱 Generating user registration test credentials..."

    # Generate unique ID for credentials file (must be passed from Playwright for concurrency)
    unique_id = ENV['TEST_UNIQUE_ID'] || SecureRandom.uuid
    credentials_file = Rails.root.join('tmp', "test_credentials_#{unique_id}.json")

    # Generate credentials for a new user (no database record yet)
    credentials = {
      first_name: "New",
      last_name: "Registrant",
      email: "newuser-#{unique_id}@example.com",
      phone: "555-123-4567",
      password: "securepass123"
    }
    File.write(credentials_file, credentials.to_json)

    puts "✅ Credentials generated!"
    puts "  Email: #{credentials[:email]}"
    puts "  Password: #{credentials[:password]}"
    puts "  Credentials file: #{credentials_file}"
  end

  def write_test_credentials(unique_id, credentials)
    file = Rails.root.join("tmp", "test_credentials_#{unique_id}.json")
    File.write(file, credentials.to_json)
    puts "  Credentials file: #{file}"
  end

  desc "Captain with a 2025 team of three racers and an empty team in a current open race"
  task past_racers: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding past racers test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Past",
      email: "past-captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    past_race = FactoryBot.create(:race,
      name: "Race Past #{unique_id[0..7]}",
      people_per_team: 3,
      max_teams: 100
    )
    past_team = FactoryBot.create(:team, name: "Test Team Past #{unique_id[0..7]}", race: past_race, user: captain)
    racers = %w[Ada Grace Edsger].map.with_index do |first_name, index|
      FactoryBot.create(:person,
        team: past_team,
        first_name: first_name,
        last_name: "Racer",
        email: "past-racer#{index + 1}-#{unique_id}@example.com",
        phone: "312-555-010#{index}",
        experience: 2
      )
    end
    # Racers can only be added while a race is open, so move it into 2025 afterwards.
    past_race.update_columns(
      registration_open: Time.zone.local(2025, 1, 1),
      registration_close: Time.zone.local(2025, 2, 1),
      final_edits_close: Time.zone.local(2025, 2, 15),
      race_datetime: Time.zone.local(2025, 3, 1)
    )

    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 3,
      max_teams: 100
    )
    team = FactoryBot.create(:team, name: "Test Team Current #{unique_id[0..7]}", race: race, user: captain)

    write_test_credentials(unique_id,
      captain_email: captain.email,
      captain_password: "password123",
      race_id: race.id,
      race_name: race.name,
      team_id: team.id,
      team_name: team.name,
      past_racers: racers.map { |r| { first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone } }
    )
    puts "✅ Seeded captain #{captain.email} with #{racers.size} past racers"
  end

  desc "Captain with one racer already on the roster and one past racer who last raced at 7 years"
  task racer_details: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding racer details test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Details",
      email: "details-captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    past_race = FactoryBot.create(:race, name: "Race Details Past #{unique_id[0..7]}", people_per_team: 4, max_teams: 100)
    past_team = FactoryBot.create(:team, name: "Test Team Details Past #{unique_id[0..7]}", race: past_race, user: captain)
    veteran = FactoryBot.create(:person,
      team: past_team,
      first_name: "Ada",
      last_name: "Veteran",
      email: "details-veteran-#{unique_id}@example.com",
      phone: "312-555-0100",
      experience: 7
    )
    # Racers can only be added while a race is open, so move it into 2025 afterwards.
    past_race.update_columns(
      registration_open: Time.zone.local(2025, 1, 1),
      registration_close: Time.zone.local(2025, 2, 1),
      final_edits_close: Time.zone.local(2025, 2, 15),
      race_datetime: Time.zone.local(2025, 3, 1)
    )

    race = FactoryBot.create(:race, name: "Race Details #{unique_id[0..7]}", people_per_team: 4, max_teams: 100)
    team = FactoryBot.create(:team, name: "Test Team Details #{unique_id[0..7]}", race: race, user: captain)
    existing = FactoryBot.create(:person,
      team: team,
      first_name: "Bo",
      last_name: "Roster",
      email: "details-roster-#{unique_id}@example.com",
      phone: "312-555-0101",
      experience: 1
    )

    write_test_credentials(unique_id,
      captain_email: captain.email,
      captain_password: "password123",
      team_id: team.id,
      team_name: team.name,
      roster_email: existing.email,
      new_email: "details-new-#{unique_id}@example.com",
      veteran_email: veteran.email
    )
    puts "✅ Seeded captain #{captain.email}"
  end

  desc "Captain's team with answered questions, plus a finalized and an unfinalized team in the same open race"
  task buddy_picker: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding team picker test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    answers = File.read(Rails.root.join("spec", "fixtures", "files", "valid_team_jsonform.json"))

    race = FactoryBot.create(:race_with_jsonform,
      name: "Race Picker #{unique_id[0..7]}",
      people_per_team: 2,
      max_teams: 100
    )

    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Picker",
      email: "picker-captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    # Answers saved but the same-route question left unanswered, like a team from before it existed.
    team = FactoryBot.create(:team, name: "Test Team Picker #{unique_id[0..7]}", race: race, user: captain,
                             jsonform: answers, collaborating: nil)

    # Names chosen so byte order (uppercase first) differs from case-insensitive order.
    other_teams = [["Banana Crew", true], ["apple cart", false]].map.with_index do |(name, finalized), index|
      owner = FactoryBot.create(:user, email: "picker-owner#{index + 1}-#{unique_id}@example.com")
      other = FactoryBot.create(:team, name: name, race: race, user: owner, jsonform: answers)
      if finalized
        FactoryBot.create_list(:person, race.people_per_team, team: other)
        # Not Team#finalize: that enqueues TeamFinalizer (email, Classy) into the shared Redis.
        other.update_columns(finalized: true, notified_at: Time.zone.now, assigned_team_number: 1)
      end
      other
    end

    write_test_credentials(unique_id,
      captain_email: captain.email,
      captain_password: "password123",
      race_name: race.name,
      team_id: team.id,
      team_name: team.name,
      teams: other_teams.map { |t| { name: t.name, finalized: !!t.finalized } }
    )
    puts "✅ Seeded captain #{captain.email} with #{other_teams.size} other teams in #{race.name}"
  end

  desc "Captain's team in a race whose form hides fire-details unless flame-effects is Yes (showWhen)"
  task show_when: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding showWhen test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    answers = JSON.parse(File.read(Rails.root.join("spec", "fixtures", "files", "valid_team_jsonform.json")))
    answers["flame-effects"] = "No"

    # The standard form plus an optional fire-details textarea right after flame-effects.
    jsonform = JSON.parse(File.read(Rails.root.join("spec", "fixtures", "files", "valid_jsonform.json")))
    jsonform["schema"]["properties"]["fire-details"] = { "type" => "string", "title" => "Details about your fire effects" }
    add_fire_details = lambda do |items|
      items.flat_map do |item|
        if item == "flame-effects"
          [item, { "key" => "fire-details", "type" => "textarea", "showWhen" => { "flame-effects" => "Yes" } }]
        elsif item.is_a?(Hash) && item["items"].is_a?(Array)
          [item.merge("items" => add_fire_details.call(item["items"]))]
        else
          [item]
        end
      end
    end
    jsonform["form"] = add_fire_details.call(jsonform["form"])

    race = FactoryBot.create(:race_with_jsonform,
      name: "Race ShowWhen #{unique_id[0..7]}",
      people_per_team: 2,
      max_teams: 100,
      json_data: JSON.generate(jsonform)
    )
    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "ShowWhen",
      email: "showwhen-captain-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    team = FactoryBot.create(:team, name: "Test Team ShowWhen #{unique_id[0..7]}", race: race, user: captain, jsonform: JSON.generate(answers),
                                collaborating: false)

    write_test_credentials(unique_id,
      captain_email: captain.email,
      captain_password: "password123",
      race_name: race.name,
      team_id: team.id,
      team_name: team.name
    )
    puts "✅ Seeded captain #{captain.email} with #{team.name} in #{race.name}"
  end

  desc "Four races in each registration state (race dates run opposite to the list order) and a captain with a team in the open and the closed race"
  task race_list_order: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding race list order test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "RaceList",
      email: "race-list-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    # Race dates run opposite to the expected list order, so date order alone cannot pass.
    open_race = FactoryBot.create(:race, name: "Race #{short} Open", people_per_team: 2, max_teams: 100,
      race_datetime: 8.weeks.from_now)
    open_team = FactoryBot.create(:team, name: "Test Team Open #{short}", race: open_race, user: captain)

    waitlist_race = FactoryBot.create(:race, name: "Race #{short} Waitlist", people_per_team: 2, max_teams: 1,
      race_datetime: 6.weeks.from_now)
    filler = FactoryBot.create(:user, email: "race-list-filler-#{unique_id}@example.com")
    filler_team = FactoryBot.create(:team, name: "Test Team Filler #{short}", race: waitlist_race, user: filler)
    FactoryBot.create_list(:person, waitlist_race.people_per_team, team: filler_team)
    # Not Team#finalize: that enqueues TeamFinalizer (email, Classy) into the shared Redis.
    filler_team.update_columns(finalized: true, notified_at: Time.zone.now, assigned_team_number: 1)

    closed_race = FactoryBot.create(:race, name: "Race #{short} Closed", people_per_team: 2, max_teams: 100,
      race_datetime: 5.weeks.from_now)
    closed_team = FactoryBot.create(:team, name: "Test Team Closed #{short}", race: closed_race, user: captain)
    # Teams can only be created while a race is open, so close registration afterwards.
    closed_race.update_columns(
      registration_open: 3.weeks.ago,
      registration_close: 1.day.ago,
      final_edits_close: 1.week.from_now
    )

    not_yet_open_race = FactoryBot.create(:race, name: "Race #{short} Not Yet Open", people_per_team: 2, max_teams: 100,
      registration_open: 1.week.from_now, registration_close: 2.weeks.from_now,
      final_edits_close: 3.weeks.from_now, race_datetime: 4.weeks.from_now)

    write_test_credentials(unique_id,
      short_id: short,
      captain_email: captain.email,
      captain_password: "password123",
      race_names: {
        open: open_race.name,
        waitlist: waitlist_race.name,
        closed: closed_race.name,
        not_yet_open: not_yet_open_race.name
      },
      open_team_name: open_team.name,
      closed_team_name: closed_team.name
    )
    puts "✅ Seeded four races for #{short} and captain #{captain.email}"
  end

  desc "Captain's unfinalized team with two racers (neither is the account holder) and no team captain"
  task team_captain: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding team captain test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    # Three slots with two racers, so the team stays unfinalized while the captain is chosen.
    race = FactoryBot.create(:race, name: "Race Captain #{unique_id[0..7]}", people_per_team: 3, max_teams: 100)
    owner = FactoryBot.create(:user,
      first_name: "Owner",
      last_name: "Account",
      email: "captain-owner-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    team = FactoryBot.create(:team, name: "Test Team Captain #{unique_id[0..7]}", race: race, user: owner)
    racers = [["Ada", "Racer"], ["Bo", "Pilot"]].map.with_index do |(first, last), index|
      FactoryBot.create(:person, team: team, first_name: first, last_name: last,
                                 email: "captain-racer#{index + 1}-#{unique_id}@example.com")
    end

    write_test_credentials(unique_id,
      captain_email: owner.email,
      captain_password: "password123",
      race_name: race.name,
      team_id: team.id,
      team_name: team.name,
      racers: racers.map { |r| { id: r.id, name: "#{r.first_name} #{r.last_name}" } }
    )
    puts "✅ Seeded #{owner.email} with a team of #{racers.size} racers and no captain in #{race.name}"
  end

  desc "Race closing in 23 hours with an unfinalized team (due a closing-day reminder)"
  task reminder: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding registration reminder test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    captain = FactoryBot.create(:user,
      first_name: "Captain",
      last_name: "Reminder",
      email: "reminder-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 2,
      max_teams: 100,
      registration_open: 1.week.ago,
      registration_close: 23.hours.from_now,
      final_edits_close: 3.days.from_now,
      race_datetime: 2.weeks.from_now
    )
    team = FactoryBot.create(:team, name: "Test Team Reminder #{unique_id[0..7]}", race: race, user: captain)

    write_test_credentials(unique_id,
      captain_email: captain.email,
      race_id: race.id,
      race_name: race.name,
      team_id: team.id,
      team_name: team.name
    )
    puts "✅ Seeded unfinalized team #{team.name} (ID: #{team.id}) in race closing in 23h"
  end

  desc "Clean up all test data"
  task cleanup: [:guard, :environment] do
    puts "🧹 Cleaning up test data..."

    keep = ["test+admin@example.com", "test+operator@example.com"]

    # Count before deletion (exclude the static admin and operator users)
    count = {
      users: User.where("email LIKE ? AND email NOT IN (?)", "%@example.com", keep).count,
      teams: Team.where("name LIKE ?", "Test Team%").count,
      races: Race.where("name LIKE ?", "Race %").count
    }

    # Delete test data (keep the static admin and operator users)
    SentEmail.where("recipient LIKE ?", "%@example.com").delete_all
    User.where("email LIKE ? AND email NOT IN (?)", "%@example.com", keep).destroy_all
    Team.where("name LIKE ?", "Test Team%").destroy_all
    # Every seed names its races "Race ...", its teams "Test Team ..." and its users @example.com, so
    # this sweep covers them all (racer_details included).
    # Seeded teams with their own names (e.g. buddy_picker); team_buddies rows go by FK cascade.
    Team.where(race_id: Race.where("name LIKE ?", "Race %").select(:id)).destroy_all
    Race.where("name LIKE ?", "Race %").destroy_all

    puts "  ✓ Deleted #{count[:users]} test users"
    puts "  ✓ Deleted #{count[:teams]} test teams"
    puts "  ✓ Deleted #{count[:races]} test races"
    puts ""
    puts "✅ Test data cleaned up!"
  end
end
