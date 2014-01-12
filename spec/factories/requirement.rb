FactoryGirl.define do
  factory :requirement do
    name 'Requirement'
    race

    #todo -get rid of this
    factory :requirement2 do
      name 'Requirement 2'
    end
  end

  sequence :payment_requirement_name do |n|
    "Payment Requirement #{n}"
  end

  factory :payment_requirement do
    name { generate(:payment_requirement_name) }
    type 'PaymentRequirement'
    race

    factory :payment_requirement_with_tier, :aliases => [:enabled_payment_requirement] do
      name 'Payment Requirement w/ tier'
      after(:create) do |pay_req, evaluator|
        create_list(:tier, 1, requirement: pay_req)
      end
    end
  end

end
