class StripeHelper
  class << self

    def safely_call_stripe
      begin
        yield
        [true, nil]

      rescue Stripe::CardError => e
        # Stripe::CardError will be caught if card is declined.

        Rails.logger.error e.class
        Rails.logger.error "HTTP status: #{e.http_status}"

        if e.json_body.present? && e.json_body[:error].present?
          err = e.json_body[:error]
          Rails.logger.error "type: #{err[:type]}"
          Rails.logger.error "code: #{err[:code]}"
          Rails.logger.error "param: #{err[:param]}"
          Rails.logger.error "message: #{err[:message]}"
        end

      rescue Stripe::AuthenticationError, Stripe::APIConnectionError,
        Stripe::StripeError, Stripe::InvalidRequestError => ex

        log_and_return_error(ex)

      #TODO: change to StandardError, consider deleting altogether
      rescue => ex
        log_and_return_error(ex)
      end
    end

    def exception_to_hash(ex)
      hash = {
        class: ex.class.to_s,
        reason: ex.message
      }

      if ex.respond_to?(:http_status) && ex.http_status
        hash[:http_status] = ex.http_status
      end

      if ex.respond_to?(:json_body) && ex.json_body.present? && ex.json_body[:error].present?
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

    def log_and_return_error(ex)
      Rails.logger.error(exception_to_hash(ex).to_json)
      [false, ex]
    end
  end
end
