class StripeHelper
  class << self

    def safely_call_stripe
      begin
        yield
      rescue Stripe::CardError => e
        # Since it's a decline, Stripe::CardError will be caught
        body = e.json_body
        err = body[:error]
        Rails.logger.error e.class
        Rails.logger.error msg if msg
        Rails.logger.error "status: #{e.http_status}"
        Rails.logger.error "type: #{err[:type]}"
        Rails.logger.error "code: #{err[:code]}"
        Rails.logger.error "param: #{err[:param]}"
        Rails.logger.error "message: #{err[:message]}"
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
      Rails.logger.error e.class
      Rails.logger.error msg if msg
    end

  end
end
