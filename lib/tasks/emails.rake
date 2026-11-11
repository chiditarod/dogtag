namespace :emails do
  desc "Verify that every email a team should have received was sent and delivered"
  task :verify, [:team_id] => :environment do |_task, args|
    abort "Usage: rake emails:verify[team_id]" if args[:team_id].blank?

    verifier = EmailVerifier.new(Team.find(args[:team_id]))
    verifier.print
    exit 1 unless verifier.ok?
  end
end
