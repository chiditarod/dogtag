# Reopens a refunded payment: the requirement counts as not completed again, so the team can pay again (and a
# finalized team that no longer meets the finalization requirements is un-finalized). Nothing is deleted. The
# row keeps who refunded it and when, and records who reopened it and when, so the payment's whole history
# stays auditable. Only a refunded payment can be reopened, so money the racer still holds is never reopened.
#
# Takes the same advisory lock as Payments::ChargeTeam and Payments::RefundCharge, so a reopen never runs
# alongside a payment or a refund of the same team and requirement. Messages are for staff and are not
# translated.
module Payments
  class ReopenPayment
    Result = Data.define(:ok, :code, :message)

    def self.call(**) = new(**).call

    def initialize(user:, completed_requirement:)
      @user = user
      @cr = completed_requirement
    end

    def call
      result = AdvisoryLock.with_lock(team_id: cr.team_id, requirement_id: cr.requirement_id) { reopen }
      result.equal?(AdvisoryLock::HELD) ? failure(:in_progress, "Another request is working on this payment. Try again in a moment.") : result
    rescue => e
      Rails.logger.error("Reopen failed for completed requirement #{cr.id}: #{e.class}: #{e.message}")
      AdvisoryLock.alert("Reopen failed for completed requirement #{cr.id}, team #{cr.team_id} (#{e.class}: #{e.message}).")
      failure(:unexpected, "The payment could not be reopened. Try again.")
    end

    private

    attr_reader :user, :cr

    # Runs inside the lock.
    def reopen
      cr.reload
      return success(:already_reopened, "This payment was already reopened.") if cr.reopened?
      return failure(:not_refunded, "Only a refunded payment can be reopened.") unless cr.refunded?

      # Skips validations on purpose, like Payments::RefundCharge#record: the row may no longer validate.
      cr.update_columns(reopened_at: Time.current, reopened_by_id: user&.id, updated_at: Time.current)
      Rails.logger.info("Payment reopened: charge #{cr.charge_id}, team #{cr.team_id}, requirement #{cr.requirement_id}, user #{user&.id}, at #{Time.current.iso8601}")
      CompletedRequirementAuditor.new.reopen_completed_requirement_successful(cr)
      success(:reopened, "The payment was reopened. The team can pay again.")
    end

    def success(code, message) = Result.new(ok: true, code: code, message: message)

    def failure(code, message) = Result.new(ok: false, code: code, message: message)
  end
end
