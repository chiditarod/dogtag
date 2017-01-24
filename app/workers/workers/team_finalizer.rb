module Workers
  class TeamFinalizer
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :important, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data={})
      job_email = Workers::TeamFinalizedEmail.perform_async({team_id: job['team_id']})
      job_classy = Workers::ClassyCreateFundraisingTeam.perform_async({team_id: job['team_id']})

      data[:child_job_ids] = {
        team_finalized_email: job_email,
        classy_create_fundraising_team: job_classy
      }
      log("complete", data)
    end
  end
end
