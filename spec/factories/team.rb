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
          create_list(:person, team.race.people_per_team, team: team)
          team.finalize
        end
      end
    end

    factory :team_with_jsonform do
      jsonform File.read(Rails.root.to_s + '/spec/fixtures/files/valid_team_jsonform.json')
      race factory: :race_with_jsonform
    end

    trait :with_classy_id do
      classy_id 123456
    end

    # classy_id is a prerequisite
    trait :with_classy_fundraising_page do
      classy_id 123456
      classy_fundraiser_page_id 42
    end

    trait :with_people do
      transient do
        people_count { race.people_per_team - 1 }
      end
      after(:create) do |team, evaluator|
        create_list(:person, evaluator.people_count, team: team)
      end
    end

    trait :with_enough_people do
      after(:create) do |team|
        create_list(:person, team.race.people_per_team, team: team)
      end
    end
  end
end
