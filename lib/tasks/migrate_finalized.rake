namespace :migrations do
  namespace :teams do
    task :backfill_finalized_column => [:environment] do
      finalized_teams = Team.all.select{ |t| t.meets_finalization_requirements? }
      finalized_teams.each do |team|
        team.finalized = true
        team.save
      end
    end

    task :nullify_finalized_column => [:environment] do
      Team.all.each do |team|
        team.finalized = nil
        team.save
      end
    end
  end
end
