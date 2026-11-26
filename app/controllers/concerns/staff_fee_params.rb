# Fee prices are entered in whole dollars and travel as cents, so the staff fee and price
# endpoints share one check.
module StaffFeeParams
  extend ActiveSupport::Concern

  WHOLE_DOLLARS = "Whole dollars only, $1 or more.".freeze
  MAX_PRICE_CENTS = 10_000_000
  TOO_EXPENSIVE = "Must be $100,000 or less.".freeze

  private

  # The message when `price` (cents, as sent) is not a whole number of dollars of at least $1,
  # or is more than the integer column holds sensibly ($100,000).
  def whole_dollar_error(price)
    return WHOLE_DOLLARS unless price.is_a?(Integer) && price >= 100 && (price % 100).zero?

    TOO_EXPENSIVE if price > MAX_PRICE_CENTS
  end
end
