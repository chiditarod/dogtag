require 'sidekiq/api'

module Workers
  module Common

    def perform(original_job)
      original_job = {} if original_job.nil?
      job = Marshal.load(Marshal.dump(original_job))

      log = {
        job: job
      }
      log("received", log)
      run(job, log)

    rescue StandardError, EOFError, SystemCallError, SocketError => ex
      log("error", {}, :error, ex)
      raise ex
    end

    def run
      raise "implement where you include Workers::Common!"
    end

    def log(event, data={}, level=:info, exception=nil)
      log = {
        event: event,
        worker: self.class.to_s,
        jid: self.jid,
        data: data
      }
      if exception.present?
        log[:exception] = {
          klass: exception.class,
          message: exception.message,
          backtrace: exception.backtrace
        }
      end
      Rails.logger.send(level, log)
    end
  end
end
