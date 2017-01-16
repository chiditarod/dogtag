module Workers
  class TeamFinalizedEmail
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :default, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data={})
      team = Team.includes(:user).includes(:race).find(job['team_id'])
      user = team.user
      UserMailer.team_finalized_email(user, team).deliver_now
      log("complete")
    end
  end
end
