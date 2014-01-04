FactoryGirl.define do
  #factory :payment_requirement, :parent => :requirement, :class => 'PaymentRequirement' do
  factory :payment_requirement do
    name 'Sample payment requirement'

    #factory :payment_requirenent_with_tiers do
      #after(:create) do |payment_requirement, evaluator|
      #end
    #end

  end
end
