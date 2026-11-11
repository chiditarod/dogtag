# Rake task to seed test data for integration tests
# Usage:
#   rails test_seeds:admin                     (create admin user only)
#   rails test_seeds:basic                     (create full test environment using factories)
#   rails test_seeds:payment_tiers             (create payment tiers test data)
#   rails test_seeds:stripe_payment            (create Stripe payment test data)
#   rails test_seeds:user_registration         (generate credentials for registration test)
#   rails test_seeds:password_reset            (create user for password reset test)
#   rails test_seeds:password_reset_token      (generate perishable token for password reset)
#   rails test_seeds:spa_registration          (open race with questions + mock fee for the SPA registration flow)
#   rails test_seeds:past_racers               (captain with a 2025 team and an empty current team)
#   rails test_seeds:reminder                  (race closing in 23h with an unfinalized team)
#   rails test_seeds:cleanup                   (clean up all test data)

namespace :test_seeds do
  desc "Create admin user only (static email)"
  task admin: :environment do
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

  desc "Create basic test environment using factories: captain, race, team with 4 people"
  task basic: :environment do
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
        email: "person#{i + 1}-#{unique_id}@example.com"
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
  task payment_tiers: :environment do
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
        email: "person#{i + 1}-#{unique_id}@example.com"
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
  task stripe_payment: :environment do
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
        email: "person#{i + 1}-#{unique_id}@example.com"
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
  task password_reset: :environment do
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
  task password_reset_token: :environment do
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
  task user_registration: :environment do
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

  # Small JSONForm whose answers are all single strings: radios, textarea,
  # agree checkbox and a select (4+ options).
  SPA_TEST_JSONFORM = {
    schema: {
      type: "object",
      properties: {
        "racer-type" => { title: "Team type", type: "string", enum: ["Racer", "Art Cart"], required: true },
        "explain-theme" => { title: "Your theme", type: "string", required: true },
        "agree-to-rules" => { title: "I will follow the race rules", type: "string", required: true, pattern: "^Yes$", enum: %w[No Yes] },
        "fundraising" => { title: "Fundraising plans", type: "string", required: true, enum: ["Yes!", "Probably", "Maybe", "No fundraising for me"] }
      }
    },
    form: [
      "racer-type",
      { key: "explain-theme", type: "textarea" },
      "agree-to-rules",
      "fundraising",
      { type: "submit", title: "Save" }
    ]
  }.to_json.freeze

  def write_test_credentials(unique_id, credentials)
    file = Rails.root.join("tmp", "test_credentials_#{unique_id}.json")
    File.write(file, credentials.to_json)
    puts "  Credentials file: #{file}"
  end

  desc "Open race (JSONForm questions, mock fee, 2 racers per team) and credentials for a brand-new SPA user"
  task spa_registration: :environment do
    require "factory_bot_rails"
    require "json"
    require "securerandom"

    puts "🌱 Seeding SPA registration test..."
    unique_id = ENV["TEST_UNIQUE_ID"] || SecureRandom.uuid

    race = FactoryBot.create(:race,
      name: "Race #{unique_id[0..7]}",
      people_per_team: 2,
      max_teams: 100,
      jsonform: SPA_TEST_JSONFORM
    )
    requirement = MockPaymentRequirement.create!(name: "Registration Fee", race: race)
    tier = Tier.create!(requirement: requirement, price: 5000, begin_at: 10.days.ago)

    write_test_credentials(unique_id,
      first_name: "Spa",
      last_name: "Registrant",
      email: "spa-#{unique_id}@example.com",
      phone: "3125550100",
      password: "securepass123",
      race_id: race.id,
      race_name: race.name,
      people_per_team: race.people_per_team,
      fee_cents: tier.price
    )
    puts "✅ Seeded race #{race.name} (ID: #{race.id})"
  end

  desc "Captain with a 2025 team of three racers and an empty team in a current open race"
  task past_racers: :environment do
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
        zipcode: "6060#{index + 1}",
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
      past_racers: racers.map { |r| { first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone, zipcode: r.zipcode } }
    )
    puts "✅ Seeded captain #{captain.email} with #{racers.size} past racers"
  end

  desc "Race closing in 23 hours with an unfinalized team (due a closing-day reminder)"
  task reminder: :environment do
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
  task cleanup: :environment do
    puts "🧹 Cleaning up test data..."

    # Count before deletion (exclude the static admin user)
    count = {
      users: User.where("email LIKE ? AND email != ?", "%@example.com", "test+admin@example.com").count,
      teams: Team.where("name LIKE ?", "Test Team%").count,
      races: Race.where("name LIKE ?", "Race %").count
    }

    # Delete test data (keep the static admin user)
    SentEmail.where("recipient LIKE ?", "%@example.com").delete_all
    User.where("email LIKE ? AND email != ?", "%@example.com", "test+admin@example.com").destroy_all
    Team.where("name LIKE ?", "Test Team%").destroy_all
    Race.where("name LIKE ?", "Race %").destroy_all

    puts "  ✓ Deleted #{count[:users]} test users"
    puts "  ✓ Deleted #{count[:teams]} test teams"
    puts "  ✓ Deleted #{count[:races]} test races"
    puts ""
    puts "✅ Test data cleaned up!"
  end
end
