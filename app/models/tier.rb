class Tier < ActiveRecord::Base
  # begin_at
  # price
  validates_with TierValidator

  # for PaymentRequirement
  belongs_to :requirement
end
