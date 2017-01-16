module Workers
  class WelcomeEmail
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :default, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data={})
      %w(user_id).each do |key|
        job[key].present? || raise("Missing '#{key}' key in job hash")
      end

      user = User.find(job['user_id'])
      UserMailer.welcome_email(user).deliver_now
      log("complete")
    end
  end
end
