namespace :staging do
  desc "Seed an EMPTY database with small synthetic staging data (see lib/staging_seed.rb). " \
       "Needs SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_PASSWORD; optional SEED_EMAIL_BASE, SEED_CLASSY_CAMPAIGN_ID"
  task seed: :environment do
    summary = StagingSeed.new.run
    puts "Seeded staging data: #{summary.except(:admin).map { |k, v| "#{v} #{k}" }.join(', ')}"
    puts "Admin login: #{summary[:admin]}"
  rescue StagingSeed::Refused => e
    abort "staging:seed refused: #{e.message}"
  end
end
