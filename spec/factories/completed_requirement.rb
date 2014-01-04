FactoryGirl.define do
  factory :completed_requirement do
    association :registration
    association :requirement
    association :user
  end
end
