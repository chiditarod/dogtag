FactoryGirl.define do
  factory :requirement do
    name 'Sample Requirement'

    factory :requirement2 do
      name 'Sample Requirement 2'
    end
  end

  factory :payment_requirement do
    name 'Sample Payment Requirement'
    type 'PaymentRequirement'
  end

end
