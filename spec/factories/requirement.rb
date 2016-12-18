FactoryGirl.define do
  factory :requirement do
    name 'Requirement'
    race

    #todo -get rid of this
    factory :requirement2 do
      name 'Requirement 2'
    end
  end

  factory :payment_requirement do
    sequence(:name) { |n| "Payment Requirement #{n}" }
    type 'PaymentRequirement'
    race

    factory :payment_requirement_with_tier, :aliases => [:enabled_payment_requirement] do
      name 'Payment Requirement w/ tier'
      after(:create) do |pay_req, evaluator|
        create_list(:tier, 1, requirement_id: pay_req.id)
      end
    end
  end
end
