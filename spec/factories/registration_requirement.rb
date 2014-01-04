FactoryGirl.define do
  factory :registration_requirement do

    association :registration
    association :requirement
    association :user
  end
end
