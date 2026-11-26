# Fee prices are entered in whole dollars and travel as cents, so the staff fee and price
# endpoints share one check.
module StaffFeeParams
  extend ActiveSupport::Concern

  WHOLE_DOLLARS = "Whole dollars only, $1 or more.".freeze

  private

  # The message when `price` (cents, as sent) is not a whole number of dollars of at least $1.
  def whole_dollar_error(price)
    WHOLE_DOLLARS unless price.is_a?(Integer) && price >= 100 && (price % 100).zero?
  end
end
