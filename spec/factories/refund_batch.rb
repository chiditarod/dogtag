FactoryBot.define do
  factory :refund_batch do
    association :user, factory: :refunder_user
  end

  factory :refund_batch_item do
    refund_batch
    completed_requirement { association(:completed_requirement, charge_id: "ch_#{SecureRandom.hex(6)}") }
    status { "queued" }
  end
end
