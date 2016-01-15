FactoryGirl.define do

  factory :team do
    sequence(:name)    { |n| "Team #{n}" }
    description        { "omg! #{name} is the best team evar." }
    sequence(:twitter) { |n| "@twitter#{n}" }
    experience 5

    user
    race

    factory :finalized_team do
      after(:create) do |team|
        Timecop.freeze(THE_TIME) do
          create_list(:person, 5, team: team)
          team.finalize
        end
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
