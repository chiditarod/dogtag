module MoneyHelper
  def price_in_dollars_and_cents(cents)
    return '0.00' unless cents
    cents == 0 ? '0.00' : cents.to_s.insert(-3, '.')
  end
end
