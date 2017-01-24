FactoryGirl.define do

  factory :race do
    sequence(:name) { |n| "Race #{n}" }
    registration_open (Time.now - 2.weeks)
    registration_close (Time.now + 2.weeks)
    race_datetime (Time.now + 4.weeks)
    max_teams 3
    people_per_team 3

    factory :full_race do
      after(:create) do |race, evaluator|
        create_list(:finalized_team, race.max_teams, race: race)
      end
    end

    factory :race_with_jsonform do
      transient do
        json_data File.read(Rails.root.to_s + '/spec/fixtures/files/valid_jsonform.json')
      end
      jsonform { json_data }

      factory :race_with_jsonform_and_filter_field do
        filter_field { JSON.parse(jsonform)["schema"]["properties"].keys.first(3).join(",") }
      end
    end

    factory :race_with_classy_data do
      classy_campaign_id 12345
      classy_default_goal 2000
    end

    factory :ended_race do
      registration_close (Time.now - 1.week)
      race_datetime (Time.now - 1.day)
    end

    trait :registration_closed do
      registration_close (Time.now - 1.week)
    end

    trait :registration_opens_tomorrow do
      registration_open (Time.now + 1.day)
    end

    trait :registration_closing_now do
      registration_close Time.now
    end
  end
end
