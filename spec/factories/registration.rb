FactoryGirl.define do

  factory :registration do
    sequence(:name) { |n| "Registration #{n}" }
    description 'OMG our sample team is the best!'
    sequence(:twitter) { |n| "@twitter#{n}" }

    team
    race

    racer_type 'racer'
    primary_inspiration 'white fang'
    rules_confirmation true
    sabotage_confirmation true
    cart_deposit_confirmation true
    food_confirmation true
    experience 5
  end

  trait :finalized do
    after(:create) do |registration|
      create_list(:person, 5, registration: registration)
    end
  end

  trait :with_people do
    ignore do
      people_count 4
    end
    after(:create) do |registration, evaluator|
      create_list(:person, evaluator.people_count, registration: registration)
    end
  end

end
