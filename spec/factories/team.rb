FactoryGirl.define do

  factory :team do
    sequence(:name)    { |n| "Team #{n}" }
    description        { |n| "omg! #{name} is the best team evar." }
    sequence(:twitter) { |n| "@twitter#{n}" }
    experience 5

    user
    race

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
