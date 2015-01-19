class StripeHelper
  class << self

    def log_charge_error(e)
      hash = {
        message: e.message
      }
      hash[:http_status] = e.http_status if e.http_status

      if e.json_body.present? && e.json_body[:error].present?
        json = e.json_body[:error]
        hash.merge!(
          {
            type: json[:type],
            code: json[:code],
            param: json[:param],
            message2: json[:message]
          }
        )
      end

      Rails.logger.error hash.to_json
    rescue => e
      Rails.logger.error "Error when logging stripe error: #{e}"
    end

    def safely_call_stripe
      begin
        yield
      rescue Stripe::CardError => e
        # Stripe::CardError will be caught if card is declined.
        if e.json_body.present? && e.json_body[:error].present?
          err = e.json_body[:error]
          Rails.logger.error e.class
          Rails.logger.error "HTTP status: #{e.http_status}"
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
      rescue => e
        # Something else happened, completely unrelated to Stripe
        log_error e, 'Non-Stripe Error'
      end
    end

    private

    def log_error(e, msg = nil)
      Rails.logger.error "#{e.class}: #{msg}"
    end
  end
end
