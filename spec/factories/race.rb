FactoryGirl.define do

  factory :race do
    sequence(:name) { |n| "Race #{n}" }
    registration_open (Time.now - 2.weeks)
    registration_close (Time.now + 2.weeks)
    race_datetime (Time.now + 4.weeks)
    max_teams 3
    people_per_team 5

    factory :closed_race do
      registration_close (Time.now - 1.week)
    end

    #trait :with_jsonform do
    #end
  end
end
