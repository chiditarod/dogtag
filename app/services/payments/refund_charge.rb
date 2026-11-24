# Fully refunds one payment (a completed requirement with a Stripe charge) and records who did it and when.
# Called by the legacy Refund button and by Workers::RefundBatch, so both are audited, emailed and safe to
# repeat. Safety comes from three things:
#
# - the same advisory lock as Payments::ChargeTeam, so a refund and a charge, or two refunds, of one
#   payment never run at once;
# - a check of the charge at Stripe before refunding, so a charge already refunded (in the Stripe
#   dashboard, or by an earlier attempt that died before saving) is recorded instead of refunded again;
# - a Stripe idempotency key per charge (`refund-<charge id>`, unique across databases sharing a Stripe account), so a repeat after a crash returns the same refund.
#
# Messages are for staff and are not translated; the racer's email is.
module Payments
  class RefundCharge
    Result = Data.define(:ok, :code, :message)

    # Test-only failure hook for the partial-failure e2e spec: a mock payment whose charge id starts with this
    # fails its first refund attempt with a retryable error and refunds on the next. It is reachable only
    # through refund_mock, which refuses in production before looking at the charge id, and mock payments are
    # not refundable in production at all (CompletedRequirement.payment_status_sql).
    FAIL_ONCE_PREFIX = "mock_fail_once_"

    def self.call(**) = new(**).call

    def initialize(user:, completed_requirement:)
      @user = user
      @cr = completed_requirement
    end

    def call
      return failure(:not_refundable, "This payment cannot be refunded here (no Stripe charge).") if cr.payment_status == "not_refundable"

      result = AdvisoryLock.with_lock(team_id: cr.team_id, requirement_id: cr.requirement_id) { refund }
      result.equal?(AdvisoryLock::HELD) ? failure(:in_progress, "Another request is working on this payment. Try again in a moment.") : result
    rescue Stripe::InvalidRequestError => e
      stripe_failure(e, "Stripe could not refund this payment: #{StripeHelper.exception_to_hash(e)[:reason]}")
    rescue Stripe::StripeError => e
      alert_unknown_outcome(e)
      stripe_failure(e, "Stripe did not answer cleanly (#{StripeHelper.exception_to_hash(e)[:reason]}). Try again; a retry checks Stripe before refunding.")
    rescue => e
      alert_unknown_outcome(e)
      alert("Refunded at Stripe but not recorded: refund #{@refund.id}, charge #{cr.charge_id}, team #{cr.team_id}, requirement #{cr.requirement_id} (#{e.class}: #{e.message}). Retrying records it.") if @refund
      Rails.logger.error("Refund failed for completed requirement #{cr.id}: #{e.class}: #{e.message}")
      failure(:unexpected, "The refund could not be completed. Try again, and check Stripe if it keeps failing.")
    end

    private

    attr_reader :user, :cr

    # Runs inside the lock.
    def refund
      cr.reload
      return success(:already_refunded, "This payment was already refunded.") if cr.refunded?
      return refund_mock if cr.requirement.is_a?(MockPaymentRequirement)

      charge = Stripe::Charge.retrieve(cr.charge_id)
      return record_outside_refund(charge) if charge.refunded
      return failure(:partially_refunded, partial_message(charge)) if charge.amount_refunded.to_i.positive?

      # Whole-charge refunds only: refuse unless Stripe's charge is exactly what this app recorded.
      return failure(:amount_mismatch, amount_message(charge)) unless charge.amount == cr.amount_cents

      @refund_attempted = true
      @refund = Stripe::Refund.create({ charge: cr.charge_id }, { idempotency_key: "refund-#{cr.charge_id}" })
      record(:refunded, "The refund has processed successfully.", @refund.id)
    end

    # Mock payments (development and test only; production never gets here, see payment_status) have no charge.
    def refund_mock
      # payment_status already says not_refundable in production; this keeps a mock payment from ever being
      # recorded as refunded there, whatever the caller checked.
      return failure(:not_refundable, "Mock payments cannot be refunded in production.") if Rails.env.production?

      return fail_once if fail_once_pending?

      record(:refunded, "The mock payment was marked refunded.", nil)
    end

    def fail_once_pending?
      cr.charge_id.to_s.start_with?(FAIL_ONCE_PREFIX) && !(cr.metadata || {})["fail_once_tripped"]
    end

    # Remembered in the payment's metadata so the retry succeeds.
    def fail_once
      cr.update_columns(metadata: JSON.generate((cr.metadata || {}).merge("fail_once_tripped" => true)), updated_at: Time.current)
      failure(:stripe_error, "Stripe could not refund this payment: simulated failure on the first attempt (test data). Retry it.")
    end

    # Writes the refund and queues the email, once. Never called for a payment already recorded as refunded.
    # Skips validations on purpose: a refund that reached Stripe is always recorded, even if the row would no
    # longer validate (for example the payer's account was deleted), or every retry would repeat the failure.
    def record(code, message, stripe_refund_id, refunded_at: Time.current, refunded_by: user)
      cr.update_columns(
        refunded_at: refunded_at,
        refunded_by_id: refunded_by&.id,
        stripe_refund_id: stripe_refund_id,
        metadata: JSON.generate((cr.metadata || {}).merge("refunded" => true)),
        updated_at: Time.current
      )
      queue_email
      success(code, message)
    end

    # The refund is already recorded, so a failure to queue the email must not fail the refund.
    def queue_email
      team = cr.team
      Workers::PaymentRefundedEmail.perform_async(
        "user_id" => team.user_id,
        "team_id" => team.id,
        "completed_requirement_id" => cr.id,
        "charge_id" => cr.charge_id,
        "requirement_name" => cr.requirement.name,
        "amount_cents" => cr.amount_cents,
        "race_name" => team.race.name
      )
    rescue => e
      alert("Refund email not queued for completed requirement #{cr.id}, team #{cr.team_id} (#{e.class}: #{e.message}). The refund is recorded.")
    end

    # The charge was refunded at Stripe by someone else (the dashboard) or by an attempt that died before saving.
    # Nobody in this app did it, so refunded_by stays blank, and refunded_at is when Stripe refunded it.
    def record_outside_refund(charge)
      refund = covering_refund(charge)
      record(
        :already_refunded, "This charge was already refunded at Stripe; it is now recorded here.", refund&.id,
        refunded_at: refund&.created ? Time.at(refund.created).utc : Time.current, refunded_by: nil
      )
    end

    # The refund that refunded the whole charge, if one did; otherwise the most recent one, which is the one
    # that completed it. Not the list's position: Stripe lists newest first (the mock appends), so order by time.
    def covering_refund(charge)
      refunds = charge[:refunds]&.data.to_a
      refunds.find { |refund| refund.amount == charge.amount } || refunds.max_by { |refund| refund.created.to_i }
    end

    def partial_message(charge)
      "This charge is already partially refunded (#{dollars(charge.amount_refunded)} of #{dollars(charge.amount)}). " \
        "Nothing was changed; finish it in the Stripe dashboard."
    end

    def amount_message(charge)
      recorded = cr.amount_cents ? dollars(cr.amount_cents) : "not recorded"
      "The Stripe charge is #{dollars(charge.amount)} but this payment is recorded as #{recorded}. " \
        "Nothing was refunded; check the payment in Stripe."
    end

    # A Stripe error that hides whether the refund happened. A retry heals it: it finds the charge refunded.
    def alert_unknown_outcome(exception)
      return unless @refund_attempted && @refund.nil?

      alert("Refund outcome unknown (#{exception.class}: #{exception.message}) for charge #{cr.charge_id}, team #{cr.team_id}, requirement #{cr.requirement_id}. Retry heals it: it checks Stripe before refunding.")
    end

    def dollars(cents) = ActiveSupport::NumberHelper.number_to_currency(cents.to_i / 100.0)

    def alert(message) = AdvisoryLock.alert(message)

    def success(code, message) = Result.new(ok: true, code: code, message: message)

    def failure(code, message) = Result.new(ok: false, code: code, message: message)

    def stripe_failure(exception, message)
      StripeHelper.log_and_return_error(exception)
      failure(:stripe_error, message)
    end
  end
end
