FactoryGirl.define do

  factory :race do
    sequence(:name) { |n| "Race #{n}" }
    registration_open (Time.now - 2.weeks)
    registration_close (Time.now + 2.weeks)
    race_datetime (Time.now + 4.weeks)
    max_teams 3
    people_per_team 5

    factory :race_with_jsonform do
      jsonform File.read(Rails.root.to_s + '/spec/fixtures/files/valid_jsonform.json')
    end

    trait :registration_closed do
      registration_close (Time.now - 1.week)
    end
  end
end
