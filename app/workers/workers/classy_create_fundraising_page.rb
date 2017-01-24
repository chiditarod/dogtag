module Workers
  class ClassyCreateFundraisingPage
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :important, retry: true, backtrace: true
    sidekiq_options failures: true

    # Create a new fundraiser page, owned by 'user', associated with the 'team'
    # fundraiser pages are owned by individual users. since we only have guaranteed email and other info
    # from the dogtag user account, associate this fundraiser page with that user.
    def run(job, log={})
      team = Team.includes(:user).includes(:race).find(job['team_id'])
      user = team.user
      race = team.race

      if team.classy_fundraiser_page_id.present?
        log[:message] = "Team id: #{team.id} already has a classy team fundraiser page of #{team.classy_fundraiser_page_id}"
        log("complete", log)
        return
      end

      unless team.classy_id.present?
        log("no-op", message: "Team id: #{team.id} does not have a classy ID. Set that first")
        return
      end

      unless user.classy_id.present?
        log("no-op", message: "User id: #{user.id} does not have a classy ID. Set that first")
        return
      end

      cc = ClassyClient.new
      name = "#{race.name} Fundraiser: #{team.name}"
      result = cc.create_fundraising_page(team.classy_id, user.classy_id, name, race.classy_default_goal)
      team.classy_fundraiser_page_id = result['id']
      team.save!
      UserMailer.classy_is_ready(user, team).deliver_now

      log[:response] = result
      log[:message] = "Success adding a classy fundraising page for team id: #{team.id}"
      log("complete", log)
    end
  end
end
