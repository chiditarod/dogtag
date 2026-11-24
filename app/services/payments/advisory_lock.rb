# Serializes everything that touches one payment (the charge and any refund of it) across processes, so
# two requests cannot both pass an "already paid" or "already refunded" check. The key is
# (team_id, requirement_id). Session-level, so it is taken and released on the same connection and does not
# depend on a transaction.
module Payments
  module AdvisoryLock
    HELD = Object.new.tap { |held| held.define_singleton_method(:inspect) { "Payments::AdvisoryLock::HELD" } }.freeze

    # Runs the block while holding the lock and returns its value, or returns HELD without running it
    # when another session holds the lock.
    def self.with_lock(team_id:, requirement_id:)
      ActiveRecord::Base.with_connection do |connection|
        keys = "#{Integer(team_id)}, #{Integer(requirement_id)}"
        return HELD unless connection.select_value("SELECT pg_try_advisory_lock(#{keys})")

        begin
          yield
        ensure
          release(connection, keys, team_id, requirement_id)
        end
      end
    end

    # Never lets a failed unlock replace the caller's result. A lock that was not held at release
    # (e.g. the session changed under a transaction-pooling proxy) may be stuck on another
    # connection, which would block this payment with :in_progress, so it is alerted.
    def self.release(connection, keys, team_id, requirement_id)
      return if connection.select_value("SELECT pg_advisory_unlock(#{keys})")

      alert("Payment advisory lock (#{keys}) for team #{team_id}, requirement #{requirement_id} was not held at release. Check for a stuck lock.")
    rescue => e
      alert("Failed to release payment advisory lock (#{keys}) for team #{team_id}, requirement #{requirement_id}: #{e.class}: #{e.message}")
    end
    private_class_method :release

    # An error log line that also goes to Rollbar.
    def self.alert(message)
      Rails.logger.error(message)
      Rollbar.error(message) if defined?(Rollbar)
    end
  end
end
