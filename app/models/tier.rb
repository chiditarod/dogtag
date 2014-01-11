class Tier < ActiveRecord::Base
  validates :price, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates_with TierValidator

  # STI: PaymentRequirement ==================
  belongs_to :requirement

  def price_in_dollars_and_cents
    price.to_s.insert(-3, '.')
  end
  # ===========================================

end
