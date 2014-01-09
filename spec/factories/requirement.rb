FactoryGirl.define do
  factory :requirement do
    name 'Sample Requirement'

    factory :requirement2 do
      name 'Sample Requirement 2'
    end
  end

  factory :payment_requirement do
    name 'Sample Payment Requirement'
  end

  #trait :with_tiers
    #factory :payment_requirenent_with_tiers do
      #after(:create) do |payment_requirement, evaluator|
      #end
    #end
end
