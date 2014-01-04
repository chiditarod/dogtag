class Tier < ActiveRecord::Base
  # begin_at
  # price

  # for PaymentRequirement
  belongs_to :requirement
end
