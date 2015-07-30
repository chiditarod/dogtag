class Tier < ActiveRecord::Base
  validates :price, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates_with TierValidator

  # Single Table Inheritance: PaymentRequirement
  belongs_to :requirement
end
