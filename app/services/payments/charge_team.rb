# Charges a team's card for a payment requirement and records the completed requirement.
# Shared by the legacy ChargesController and the JSON API so both enforce the same rules:
# the amount always comes from the requirement's active tier (never from the client), a
# requirement must belong to the team's race, and a paid requirement is never charged twice.
module Payments
  class ChargeTeam
    Result = Data.define(:ok, :error_code, :message, :completed_requirement)

    def self.call(**) = new(**).call

    def initialize(user:, team:, requirement:, stripe_token:, stripe_email:)
      @user = user
      @team = team
      @requirement = requirement
      @stripe_token = stripe_token
      @stripe_email = stripe_email
    end

    def call
      return failure(:wrong_race) if requirement.race_id != team.race_id
      return failure(:not_payable) unless chargeable?

      with_advisory_lock { charge_and_record }
    rescue Stripe::CardError => e
      stripe_failure(:card_error, e, e.message)
    rescue Stripe::InvalidRequestError => e
      stripe_failure(:stripe_error, e, I18n.t("charges.invalid_request", reason: StripeHelper.exception_to_hash(e)[:reason]))
    rescue Stripe::APIConnectionError => e
      stripe_failure(:stripe_error, e, I18n.t("charges.api_connection", reason: StripeHelper.exception_to_hash(e)[:reason]))
    rescue Stripe::StripeError => e
      stripe_failure(:stripe_error, e, I18n.t("charges.stripe_error"))
    rescue => e
      stripe_failure(:unexpected, e, I18n.t("charges.unexpected"))
    end

    private

    attr_reader :user, :team, :requirement, :stripe_token, :stripe_email

    # Only real payment requirements are charged; mock requirements never reach Stripe.
    def chargeable?
      requirement.is_a?(PaymentRequirement) && !requirement.is_a?(MockPaymentRequirement)
    end

    # Serializes payments for one team and requirement across processes, so two requests (even with
    # different card tokens) cannot both pass the already-paid check and charge. Session-level, so it is
    # taken and released on the same connection and does not depend on a transaction.
    def with_advisory_lock
      ActiveRecord::Base.with_connection do |connection|
        keys = "#{Integer(team.id)}, #{Integer(requirement.id)}"
        return failure(:in_progress) unless connection.select_value("SELECT pg_try_advisory_lock(#{keys})")

        begin
          yield
        ensure
          connection.select_value("SELECT pg_advisory_unlock(#{keys})")
        end
      end
    end

    def charge_and_record
      return failure(:already_paid) if requirement.completed?(team)

      amount = requirement.amount_due_cents
      return failure(:no_active_tier) if amount.nil?

      customer = Customer.get(user, stripe_token, stripe_email)
      unless customer
        Rails.logger.error "Unable to create/retrieve customer from Stripe, User ID: #{user.id}"
        return failure(:customer_failed)
      end

      record(charge_card(customer, amount), customer, amount)
    end

    def charge_card(customer, amount)
      params = requirement.stripe_params(team)
      Stripe::Charge.create(
        customer: customer.id,
        amount: amount,
        description: params[:description],
        metadata: JSON.parse(params[:metadata]),
        currency: "usd"
      )
    end

    # The card has been charged. A failure here must never be silent: the charge id is logged
    # so the money can be refunded by hand.
    def record(charge, customer, amount)
      cr = requirement.complete(team.id, user, "customer_id" => customer.id, "charge_id" => charge.id, "amount" => amount)
      return success(cr) if cr

      if requirement.completed?(team)
        log_duplicate_charge(charge)
        failure(:already_paid, I18n.t("charges.duplicate_charge"))
      else
        alert("Charged but not recorded: charge #{charge.id} for team #{team.id}, requirement #{requirement.id}, user #{user.id}. Refund or record it manually.")
        failure(:unexpected)
      end
    rescue ActiveRecord::RecordNotUnique
      log_duplicate_charge(charge)
      failure(:already_paid, I18n.t("charges.duplicate_charge"))
    rescue => e
      # An after_commit listener (e.g. team finalization) can raise after the record was committed.
      if (recorded = recorded_for(charge))
        alert("Charge #{charge.id} was recorded for team #{team.id}, requirement #{requirement.id}, but a step after saving raised #{e.class}: #{e.message}")
        success(recorded)
      else
        alert("Charged but not recorded (#{e.class}: #{e.message}): charge #{charge.id} for team #{team.id}, requirement #{requirement.id}, user #{user.id}. Refund or record it manually.")
        failure(:unexpected)
      end
    end

    # The completed requirement for this very charge, if it was committed.
    def recorded_for(charge)
      cr = requirement.cr_for(team)
      cr if cr&.metadata&.dig("charge_id") == charge.id
    rescue StandardError
      nil
    end

    def log_duplicate_charge(charge)
      alert("Duplicate charge #{charge.id} for team #{team.id}, requirement #{requirement.id}, user #{user.id}: a concurrent request already completed this requirement. Refund this charge.")
    end

    def alert(message)
      Rails.logger.error(message)
      Rollbar.error(message) if defined?(Rollbar)
    end

    def success(completed_requirement)
      Result.new(ok: true, error_code: nil, message: nil, completed_requirement: completed_requirement)
    end

    MESSAGE_KEYS = { no_active_tier: "no_active_price", customer_failed: "unable_to_get_customer" }.freeze

    def failure(code, message = I18n.t("charges.#{MESSAGE_KEYS.fetch(code, code)}"))
      Result.new(ok: false, error_code: code, message: message, completed_requirement: nil)
    end

    def stripe_failure(code, exception, message)
      StripeHelper.log_and_return_error(exception)
      failure(code, message)
    end
  end
end
