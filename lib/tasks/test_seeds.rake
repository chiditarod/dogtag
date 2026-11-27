# Rake task to seed test data for integration tests
# Usage:
#   rails test_seeds:account                   (racer with a known password, for the SPA account page)
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
#   rails test_seeds:staff_shell              (a racer and a refunder with a long first name, for the staff shell)
#   rails test_seeds:payments_admin            (a refunder and a race with 7 mock Cart Deposit payments, one refunded, plus 1 Registration payment)
#   rails test_seeds:payments_partial_failure (a refunder and three mock Cart Deposit payments, the second fails its first refund)
#   rails test_seeds:team_captain             (captain's team with two racers and no team captain chosen)
#   rails test_seeds:staff_races              (an operator, an admin and a refunder; a Busy race with a fee, a finalized team with a payment and an unfinalized team; an Empty race)
#   rails test_seeds:staff_requirements       (an operator, an admin and a refunder; an open race with a Registration Fee (two prices, one finalized paying team) and an unpaid Cart Deposit)
#   rails test_seeds:who_registered            (racer, operator and refunder; an open race with 2 finalized and 2 unfinalized teams, and a full race with a waitlist)
#   rails test_seeds:staff_users_emails       (an admin, an operator and a refunder; Ada, who owns Doge Sled with a payment and three emails; Zed, a deletable racer; one other team's reminder)
#   rails test_seeds:staff_team_panel         (an operator, a refunder and an owner; a closed race (inside final edits) with a 3-of-5 team, a payment and two emails, and an open race with a 2-of-3 team and a $50 fee)
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

  desc "A racer and a refunder with no teams (staff shell)"
  task staff_shell: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding staff shell test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    racer = FactoryBot.create(:user,
      first_name: "Racer",
      last_name: "Shell",
      email: "staff-shell-racer-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    # A 16-character first name: the 320px header check needs a long one.
    refunder = FactoryBot.create(:user,
      first_name: "Maximilienne-Ann",
      last_name: "Shell",
      email: "staff-shell-refunder-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123",
      roles: [:refunder]
    )

    write_test_credentials(unique_id,
      racer_email: racer.email,
      refunder_email: refunder.email,
      password: "password123"
    )
    puts "✅ Seeded racer #{racer.email} and refunder #{refunder.email}"
  end

  desc "A refunder and a race with seven mock Cart Deposit payments (one refunded) and one Registration payment (payments admin)"
  task payments_admin: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding payments admin test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    refunder = FactoryBot.create(:user,
      first_name: "Refunder",
      last_name: "Payments",
      email: "payments-refunder-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123",
      roles: [:refunder]
    )

    # Registration is open and the race is years out, so it is usually the page's default race (the newest
    # open race). Other seeded open races can change that, so the spec still picks it from the Race select.
    race = FactoryBot.create(:race, name: "Race Payments #{short}", race_datetime: 5.years.from_now)
    deposit = MockPaymentRequirement.create!(name: "Cart Deposit", race: race)
    Tier.create!(requirement: deposit, price: 5000, begin_at: 10.days.ago)
    registration = MockPaymentRequirement.create!(name: "Registration", race: race)
    Tier.create!(requirement: registration, price: 2500, begin_at: 10.days.ago)

    owners = (1..7).map do |n|
      owner = FactoryBot.create(:user,
        first_name: "Owner#{n}",
        last_name: "Payments",
        email: "payments-owner-#{n}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123"
      )
      team = FactoryBot.create(:team, name: "Test Team Payments #{n} #{short}", race: race, user: owner)
      CompletedRequirement.create!(
        team: team, requirement: deposit, user: owner,
        charge_id: "mock_ch_#{short}_#{n}", amount_cents: 5000,
        metadata: { "charge_id" => "mock_ch_#{short}_#{n}", "amount" => 5000 }
      )
      owner
    end

    first_team = Team.find_by!(name: "Test Team Payments 1 #{short}")
    CompletedRequirement.create!(
      team: first_team, requirement: registration, user: owners.first,
      charge_id: "mock_ch_#{short}_reg", amount_cents: 2500,
      metadata: { "charge_id" => "mock_ch_#{short}_reg", "amount" => 2500 }
    )

    refunded_team = Team.find_by!(name: "Test Team Payments 7 #{short}")
    refunded_team.completed_requirements.find_by!(requirement: deposit).update!(
      refunded_at: 3.days.ago, refunded_by: refunder, stripe_refund_id: "re_mock_#{short}"
    )

    write_test_credentials(unique_id,
      refunder_email: refunder.email,
      password: "password123",
      race_id: race.id,
      race_name: race.name,
      owner_emails: owners.map(&:email),
      team_ids: (1..7).map { |n| Team.find_by!(name: "Test Team Payments #{n} #{short}").id }
    )
    puts "✅ Seeded #{race.name} (ID: #{race.id}) with 7 Cart Deposit payments and refunder #{refunder.email}"
  end

  desc "A refunder and three mock Cart Deposit payments; the second fails its first refund attempt and succeeds on retry (non-production hook)"
  task payments_partial_failure: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding payments partial failure test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    refunder = FactoryBot.create(:user,
      first_name: "Refunder",
      last_name: "Failures",
      email: "payments-failure-refunder-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123",
      roles: [:refunder]
    )

    race = FactoryBot.create(:race, name: "Race Failures #{short}", race_datetime: 5.years.from_now)
    deposit = MockPaymentRequirement.create!(name: "Cart Deposit", race: race)
    Tier.create!(requirement: deposit, price: 5000, begin_at: 10.days.ago)

    owners = (1..3).map do |n|
      owner = FactoryBot.create(:user,
        first_name: "Owner#{n}",
        last_name: "Failures",
        email: "payments-failure-owner-#{n}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123"
      )
      team = FactoryBot.create(:team, name: "Test Team Failures #{n} #{short}", race: race, user: owner)
      # Payment 2 trips Payments::RefundCharge::FAIL_ONCE_PREFIX: its first refund fails, the retry succeeds.
      charge_id = n == 2 ? "mock_fail_once_#{short}" : "mock_ch_#{short}_#{n}"
      CompletedRequirement.create!(
        team: team, requirement: deposit, user: owner,
        charge_id: charge_id, amount_cents: 5000,
        metadata: { "charge_id" => charge_id, "amount" => 5000 }
      )
      owner
    end

    write_test_credentials(unique_id,
      refunder_email: refunder.email,
      password: "password123",
      race_id: race.id,
      race_name: race.name,
      owner_emails: owners.map(&:email),
      team_ids: (1..3).map { |n| Team.find_by!(name: "Test Team Failures #{n} #{short}").id }
    )
    puts "✅ Seeded #{race.name} (ID: #{race.id}) with 3 Cart Deposit payments (the second fails once)"
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

  desc "An operator, an admin and a refunder; a Busy race (fee, finalized team with a payment, unfinalized team) and an Empty race (staff races)"
  task staff_races: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding staff races test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    staff = lambda do |role|
      FactoryBot.create(:user,
        first_name: role.to_s.capitalize,
        last_name: "Races",
        email: "staff-races-#{role}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123",
        roles: [role]
      )
    end
    operator = staff.call(:operator)
    admin = staff.call(:admin)
    refunder = staff.call(:refunder)

    # Open now, years out, so both races list as open and the overview has dates to show.
    busy = FactoryBot.create(:race, name: "Race Staff #{short} Busy", race_datetime: 5.years.from_now,
      registration_open: 3.weeks.ago, registration_close: 4.years.from_now, final_edits_close: 4.years.from_now + 1.week,
      max_teams: 50, people_per_team: 2)
    FactoryBot.create(:race, name: "Race Staff #{short} Empty", race_datetime: 5.years.from_now,
      registration_close: 4.years.from_now, final_edits_close: 4.years.from_now + 1.week)

    owner = FactoryBot.create(:user,
      first_name: "Owner",
      last_name: "Races",
      email: "staff-races-owner-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    # Finalize before the fee exists (it would otherwise need paying first), then record the payment.
    finalized = FactoryBot.create(:finalized_team, name: "Test Team Races Done #{short}", race: busy, user: owner)
    fee = MockPaymentRequirement.create!(name: "Cart Deposit", race: busy)
    Tier.create!(requirement: fee, price: 5000, begin_at: 4.weeks.ago)
    CompletedRequirement.create!(
      team: finalized, requirement: fee, user: owner,
      charge_id: "mock_ch_#{short}_races", amount_cents: 5000,
      metadata: { "charge_id" => "mock_ch_#{short}_races", "amount" => 5000 }
    )
    FactoryBot.create(:team, name: "Test Team Races Pending #{short}", race: busy, user: owner)

    write_test_credentials(unique_id,
      operator_email: operator.email,
      admin_email: admin.email,
      refunder_email: refunder.email,
      password: "password123",
      busy_name: busy.name,
      busy_id: busy.id,
      empty_name: "Race Staff #{short} Empty",
      new_name: "Race Staff #{short} New"
    )
    puts "✅ Seeded #{busy.name} (ID: #{busy.id}) and Race Staff #{short} Empty"
  end

  desc "An operator, an admin and a refunder; a race with a paid Registration Fee (two prices) and an unpaid Cart Deposit (staff fees)"
  task staff_requirements: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding staff requirements test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    staff = lambda do |role|
      FactoryBot.create(:user,
        first_name: role.to_s.capitalize,
        last_name: "Fees",
        email: "staff-fees-#{role}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123",
        roles: [role]
      )
    end
    operator = staff.call(:operator)
    admin = staff.call(:admin)
    refunder = staff.call(:refunder)

    # Open now (America/Chicago, the column default), years out, so the add-fee form's Starts is prefilled with a past time.
    race = FactoryBot.create(:race, name: "Race Fees #{short}", race_datetime: 5.years.from_now,
      registration_open: 3.weeks.ago, registration_close: 4.years.from_now, final_edits_close: 4.years.from_now + 1.week,
      max_teams: 50, people_per_team: 2)

    owner = FactoryBot.create(:user,
      first_name: "Owner",
      last_name: "Fees",
      email: "staff-fees-owner-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    # Finalize before the fee exists (it would otherwise need paying first), then record the payment.
    team = FactoryBot.create(:finalized_team, name: "Test Team Fees #{short}", race: race, user: owner)

    # $100 from a day before registration opened, $120 from two weeks out.
    registration = MockPaymentRequirement.create!(name: "Registration Fee", race: race)
    Tier.create!(requirement: registration, price: 10_000, begin_at: race.registration_open - 1.day)
    Tier.create!(requirement: registration, price: 12_000, begin_at: 2.weeks.from_now)
    CompletedRequirement.create!(
      team: team, requirement: registration, user: owner,
      charge_id: "mock_ch_#{short}_fees", amount_cents: 10_000,
      metadata: { "charge_id" => "mock_ch_#{short}_fees", "amount" => 10_000 }
    )

    deposit = MockPaymentRequirement.create!(name: "Cart Deposit", race: race)
    Tier.create!(requirement: deposit, price: 5000, begin_at: race.registration_open - 1.day)

    write_test_credentials(unique_id,
      operator_email: operator.email,
      admin_email: admin.email,
      refunder_email: refunder.email,
      password: "password123",
      race_id: race.id,
      race_name: race.name,
      registration_id: registration.id,
      deposit_id: deposit.id,
      team_name: team.name
    )
    puts "✅ Seeded #{race.name} (ID: #{race.id}) with Registration Fee (ID: #{registration.id}) and Cart Deposit (ID: #{deposit.id})"
  end

  desc "Who's registered: a racer, an operator and a refunder; an open race (2 finalized, 2 unfinalized teams) and a full race (2 on the waitlist)"
  task who_registered: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding who's registered test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    make_user = lambda do |role, roles = []|
      FactoryBot.create(:user,
        first_name: role.to_s.capitalize,
        last_name: "Who",
        email: "who-#{role}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123",
        roles: roles
      )
    end
    racer = make_user.call(:racer)
    operator = make_user.call(:operator, [:operator])
    refunder = make_user.call(:refunder, [:refunder])
    owners = (1..4).map { |n| make_user.call(:"owner#{n}") }

    answers = JSON.parse(File.read(Rails.root.join("spec", "fixtures", "files", "valid_team_jsonform.json")))
    answers_json = lambda do |racer_type, flame|
      answers.merge("racer-type" => racer_type, "flame-effects" => flame).to_json
    end
    # Not Team#finalize: that enqueues TeamFinalizer (email, Classy) into the shared Redis.
    finalize = lambda do |team, number|
      people = FactoryBot.create_list(:person, team.race.people_per_team, team: team)
      team.update_columns(captain_id: people.first.id, finalized: true, notified_at: Time.zone.now, assigned_team_number: number)
    end

    open_race = FactoryBot.create(:race_with_jsonform,
      name: "Race Who Open #{short}",
      filter_field: "racer-type,flame-effects",
      max_teams: 10
    )
    fee = MockPaymentRequirement.create!(name: "Registration", race: open_race)
    Tier.create!(requirement: fee, price: 2500, begin_at: 10.days.ago)

    mine = FactoryBot.create(:team, name: "Test Team Who Mine #{short}", race: open_race, user: racer,
                             jsonform: answers_json.call("Racer", "No"))
    finalize.call(mine, 7)
    other = FactoryBot.create(:team, name: "Test Team Who Other #{short}", race: open_race, user: owners[0],
                              jsonform: answers_json.call("Art Cart", "Yes"))
    finalize.call(other, 12)

    # Unfinished and unpaid: the racer's own team, which they can delete. It has no racers, so no new-team flag.
    draft = FactoryBot.create(:team, name: "Test Team Who Draft #{short}", race: open_race, user: racer,
                              jsonform: answers_json.call("Racer", "No"))
    # Paid, so nobody can delete it. Its racers have no experience, so staff see the new-team flag.
    paid = FactoryBot.create(:team, name: "Test Team Who Paid #{short}", race: open_race, user: owners[1],
                             jsonform: answers_json.call("Art Cart", "Yes"))
    FactoryBot.create_list(:person, open_race.people_per_team, team: paid, experience: 0)
    CompletedRequirement.create!(
      team: paid, requirement: fee, user: owners[1],
      charge_id: "mock_ch_#{short}_who", amount_cents: 2500,
      metadata: { "charge_id" => "mock_ch_#{short}_who", "amount" => 2500 }
    )

    # One spot, taken, so the other two teams are on the waitlist (oldest first).
    full_race = FactoryBot.create(:race, name: "Race Who Full #{short}", max_teams: 1)
    finalize.call(FactoryBot.create(:team, name: "Test Team Who Seated #{short}", race: full_race, user: owners[2]), 1)
    first_wait = FactoryBot.create(:team, name: "Test Team Who Wait First #{short}", race: full_race, user: owners[3])
    second_wait = FactoryBot.create(:team, name: "Test Team Who Wait Second #{short}", race: full_race, user: racer)
    first_wait.update_columns(created_at: 2.minutes.ago)
    second_wait.update_columns(created_at: 1.minute.ago)

    write_test_credentials(unique_id,
      racer_email: racer.email,
      operator_email: operator.email,
      refunder_email: refunder.email,
      password: "password123",
      open_race_id: open_race.id,
      open_race_name: open_race.name,
      full_race_id: full_race.id,
      mine_name: mine.name,
      other_name: other.name,
      draft_name: draft.name,
      paid_name: paid.name,
      first_wait_name: first_wait.name,
      second_wait_name: second_wait.name,
      registered_owner_emails: [racer.email, owners[0].email],
      registering_owner_emails: [racer.email, owners[1].email]
    )
    puts "✅ Seeded #{open_race.name} (ID: #{open_race.id}) and #{full_race.name} (ID: #{full_race.id})"
  end

  desc "An admin, an operator and a refunder; Ada (owns Doge Sled, one payment, three emails) and Zed (deletable) for staff users and emails"
  task staff_users_emails: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding staff users and emails test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]

    staff = lambda do |role|
      FactoryBot.create(:user,
        first_name: role.to_s.capitalize,
        last_name: "Users",
        email: "staff-users-#{role}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123",
        roles: [role]
      )
    end
    admin = staff.call(:admin)
    operator = staff.call(:operator)
    refunder = staff.call(:refunder)

    ada = FactoryBot.create(:user,
      first_name: "Ada#{short}",
      last_name: "Racer",
      email: "staff-users-ada-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    # A racer who signed themselves up and has no team or payment, so an admin may delete them.
    zed = FactoryBot.create(:user,
      first_name: "Zed#{short}",
      last_name: "Deletable",
      email: "staff-users-zed-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    other_owner = FactoryBot.create(:user,
      first_name: "Other",
      last_name: "Owner",
      email: "staff-users-other-#{unique_id}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    # Open now, years out, so racers can still be added (a person needs an open race).
    race = FactoryBot.create(:race, name: "Race StaffUsers #{short}", race_datetime: 5.years.from_now,
      registration_open: 3.weeks.ago, registration_close: 4.years.from_now, final_edits_close: 4.years.from_now + 1.week,
      max_teams: 50, people_per_team: 2)
    team = FactoryBot.create(:team, name: "Doge Sled #{short}", race: race, user: ada)
    FactoryBot.create(:person, team: team)
    other_team = FactoryBot.create(:team, name: "Test Team Users Other #{short}", race: race, user: other_owner)

    fee = MockPaymentRequirement.create!(name: "Cart Deposit", race: race)
    Tier.create!(requirement: fee, price: 5000, begin_at: 4.weeks.ago)
    CompletedRequirement.create!(
      team: team, requirement: fee, user: ada,
      charge_id: "mock_ch_#{short}_users", amount_cents: 5000,
      metadata: { "charge_id" => "mock_ch_#{short}_users", "amount" => 5000 }
    )

    mail = lambda do |attrs|
      SentEmail.create!({ mailer: "UserMailer", recipient: ada.email, user_id: ada.id, team_id: team.id, race_id: race.id }.merge(attrs))
    end
    mail.call(action: "team_finalized_email", kind: "team_finalized", subject: "Doge Sled is registered", status: "sent",
              created_at: 1.hour.ago, status_changed_at: 1.hour.ago)
    mail.call(action: "welcome_email", kind: "welcome", subject: "Welcome to CHIditarod", status: "failed",
              error: "Net::SMTPAuthenticationError: 535 Incorrect authentication data",
              created_at: 30.minutes.ago, status_changed_at: 30.minutes.ago)
    mail.call(action: "welcome_email", kind: "welcome", subject: "Welcome to CHIditarod", status: "queued",
              created_at: 2.minutes.ago, status_changed_at: 2.minutes.ago)
    SentEmail.create!(mailer: "UserMailer", action: "registration_reminder_email", kind: "registration_reminder",
                      recipient: other_owner.email, user_id: other_owner.id, team_id: other_team.id, race_id: race.id,
                      subject: "Registration closes soon", status: "sent",
                      created_at: 3.hours.ago, status_changed_at: 3.hours.ago)

    write_test_credentials(unique_id,
      admin_email: admin.email,
      operator_email: operator.email,
      refunder_email: refunder.email,
      ada_email: ada.email,
      zed_email: zed.email,
      password: "password123",
      short: short,
      team_id: team.id,
      team_name: team.name
    )
    puts "✅ Seeded #{team.name} (ID: #{team.id}) for Ada (#{ada.email}) and Zed (#{zed.email})"
  end

  desc "An operator, a refunder and an owner racer; a closed race (final-edits window) with a 3-of-5 team, and an open race with a 2-of-3 team and a $50 fee (staff team panel)"
  task staff_team_panel: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding staff team panel test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    short = unique_id[0..7]
    answers = File.read(Rails.root.join("spec", "fixtures", "files", "valid_team_jsonform.json"))

    make_user = lambda do |role, roles = []|
      FactoryBot.create(:user,
        first_name: role.to_s.capitalize,
        last_name: "Panel",
        email: "staff-panel-#{role}-#{unique_id}@example.com",
        password: "password123",
        password_confirmation: "password123",
        roles: roles
      )
    end
    operator = make_user.call(:operator, [:operator])
    refunder = make_user.call(:refunder, [:refunder])
    owner = make_user.call(:owner)
    buddy_owner = make_user.call(:buddy)

    # Racers can only be added while a race is open, so both races start open; the closed one is moved afterwards.
    closed_race = FactoryBot.create(:race_with_jsonform, name: "Race StaffTeam #{short} Closed",
      people_per_team: 5, max_teams: 100)
    team = FactoryBot.create(:team, name: "Test Team StaffPanel #{short}", race: closed_race, user: owner,
      jsonform: answers, collaborating: true, other_buddies: "Pals at the docks")
    racers = [["Ada", "Captain"], ["Bo", "Pilot"], ["Cy", "Rider"]].map.with_index do |(first, last), index|
      FactoryBot.create(:person, team: team, first_name: first, last_name: last,
        email: "staff-panel-racer#{index + 1}-#{unique_id}@example.com", phone: "312-555-01#{index}0")
    end
    team.update_columns(captain_id: racers.first.id)
    buddy = FactoryBot.create(:team, name: "Test Team StaffBuddy #{short}", race: closed_race, user: buddy_owner, jsonform: answers)
    team.buddy_teams << buddy

    cart = MockPaymentRequirement.create!(name: "Cart Deposit", race: closed_race)
    Tier.create!(requirement: cart, price: 5000, begin_at: 4.weeks.ago)
    fee = MockPaymentRequirement.create!(name: "Registration", race: closed_race)
    Tier.create!(requirement: fee, price: 12000, begin_at: 4.weeks.ago)
    CompletedRequirement.create!(
      team: team, requirement: cart, user: owner,
      charge_id: "mock_ch_#{short}_panel", amount_cents: 5000,
      metadata: { "charge_id" => "mock_ch_#{short}_panel", "amount" => 5000 }
    )
    [["team_finalized_email", "team_finalized", "Test Team StaffPanel is registered"],
     ["welcome_email", "welcome", "Welcome to CHIditarod"]].each_with_index do |(action, kind, subject), index|
      SentEmail.create!(mailer: "UserMailer", action: action, kind: kind, recipient: owner.email, user_id: owner.id,
        team_id: team.id, race_id: closed_race.id, subject: subject, status: "sent",
        created_at: (index + 1).hours.ago, status_changed_at: (index + 1).hours.ago)
    end
    # Closed for racers but inside the final-edits window, so staff and owners can still edit people.
    closed_race.update_columns(registration_open: 4.weeks.ago, registration_close: 1.day.ago,
      final_edits_close: 1.week.from_now, race_datetime: 2.weeks.from_now)

    open_race = FactoryBot.create(:race, name: "Race StaffTeam #{short} Open", people_per_team: 3, max_teams: 100)
    open_fee = MockPaymentRequirement.create!(name: "Registration", race: open_race)
    Tier.create!(requirement: open_fee, price: 5000, begin_at: 4.weeks.ago)
    open_team = FactoryBot.create(:team, name: "Test Team StaffPay #{short}", race: open_race, user: owner)
    open_racers = [["Di", "Short"], ["Ed", "Roster"]].map.with_index do |(first, last), index|
      FactoryBot.create(:person, team: open_team, first_name: first, last_name: last,
        email: "staff-panel-open#{index + 1}-#{unique_id}@example.com")
    end
    open_team.update_columns(captain_id: open_racers.first.id)

    write_test_credentials(unique_id,
      operator_email: operator.email,
      refunder_email: refunder.email,
      owner_email: owner.email,
      owner_id: owner.id,
      owner_name: "#{owner.first_name} #{owner.last_name}",
      password: "password123",
      short: short,
      closed_race_id: closed_race.id,
      closed_race_name: closed_race.name,
      closed_team_id: team.id,
      closed_team_name: team.name,
      buddy_team_name: buddy.name,
      captain_name: "Ada Captain",
      captain_email: racers.first.email,
      open_race_id: open_race.id,
      open_race_name: open_race.name,
      open_team_id: open_team.id,
      open_team_name: open_team.name,
      theme_answer: "Have to wait and see!"
    )
    puts "✅ Seeded #{team.name} (ID: #{team.id}, closed) and #{open_team.name} (ID: #{open_team.id}, open)"
  end

  desc "Create a racer with a known password for the SPA account page test"
  task account: [:guard, :environment] do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid
    credentials_file = Rails.root.join("tmp", "test_credentials_#{unique_id}.json")

    user = FactoryBot.create(:user,
      first_name: "Account",
      last_name: "TestUser",
      email: "account-#{unique_id}@example.com",
      password: "oldpassword123",
      password_confirmation: "oldpassword123")

    credentials = {
      user_email: user.email,
      password: "oldpassword123",
      new_password: "newpassword456",
      user_id: user.id
    }
    File.write(credentials_file, credentials.to_json)

    puts "Seeded account user #{user.email} / oldpassword123"
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
    # Refund batches reference users and their items reference completed requirements (FK cascade),
    # so both go before the users and races below. Completed requirements are not deleted with teams.
    RefundBatch.where(user_id: User.where("email LIKE ?", "%@example.com").select(:id)).delete_all
    CompletedRequirement.where(requirement_id: Requirement.where(race_id: Race.where("name LIKE ?", "Race %").select(:id)).select(:id)).delete_all
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
