FactoryGirl.define do
  factory :completed_requirement do
    association :registration, :complete
    association :requirement
    association :user
  end
end
