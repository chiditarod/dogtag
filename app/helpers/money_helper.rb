module MoneyHelper
  def price_in_dollars_and_cents(cents)
    cents.to_s.insert(-3, '.')
  end
end
