FactoryGirl.define do

  factory :team do
    sequence(:name) { |n| "Team #{n}" }
    description 'OMG our team is the best!'
    sequence(:twitter) { |n| "@twitter#{n}" }
    experience 5

    user
    race

    # todo: delete these once we delete the columns from the db
    racer_type 'racer'
    primary_inspiration 'white fang'
    rules_confirmation true
    sabotage_confirmation true
    cart_deposit_confirmation true
    food_confirmation true

    factory :finalized_team do
      finalized true
      after(:create) do |team|
        create_list(:person, 5, team: team)
      end
    end
  end

  trait :with_people do
    ignore do
      people_count 4
    end
    after(:create) do |team, evaluator|
      create_list(:person, evaluator.people_count, team: team)
    end
  end
end
