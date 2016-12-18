class StripeHelper
  class << self

    def safely_call_stripe
      begin
        yield
      rescue Stripe::CardError => e
        # Stripe::C`ardError will be caught if card is declined.

        Rails.logger.error e.class
        Rails.logger.error "HTTP status: #{e.http_status}"

        if e.json_body.present? && e.json_body[:error].present?
          err = e.json_body[:error]
          Rails.logger.error "type: #{err[:type]}"
          Rails.logger.error "code: #{err[:code]}"
          Rails.logger.error "param: #{err[:param]}"
          Rails.logger.error "message: #{err[:message]}"
        end
      rescue Stripe::InvalidRequestError => e
        # Invalid parameters were supplied to Stripe's API
        log_error e
      rescue Stripe::AuthenticationError => e
        # Authentication with Stripe's API failed
        # (maybe you changed API keys recently)
        log_error e
      rescue Stripe::APIConnectionError => e
        # Network communication with Stripe failed
        log_error e
      rescue Stripe::StripeError => e
        # Display a very generic error to the user, and maybe send
        # yourself an email
        log_error e

      #TODO: change to StandardError
      rescue => e
        # Something else happened, completely unrelated to Stripe
        log_error e, 'Non-Stripe Error'
      end
    end

    def log_charge_error(ex)
      Rails.logger.error exception_to_hash(ex).to_json
    rescue => ex
      Rails.logger.error "Error logging stripe error: #{ex}"
    end

    def exception_to_hash(ex)
      hash = { reason: ex.message }

      if ex.http_status
        hash[:http_status] = ex.http_status
      end

      if ex.json_body.present? && ex.json_body[:error].present?
        json = ex.json_body[:error]
        hash.merge!(
          {
            type: json[:type],
            code: json[:code],
            param: json[:param],
            message: json[:message]
          }
        )
      end

      hash
    end

    private

    def log_error(ex, msg = nil)
      text = ex.class.to_s
      text << ": #{msg}" if msg.present?
      Rails.logger.error(text)
    end
  end
end
