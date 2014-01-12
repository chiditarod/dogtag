FactoryGirl.define do
  sequence :race_name do |n|
    "Race #{n}"
  end

  factory :race do
    name { generate(:race_name) }
    registration_open (Time.now - 2.weeks)
    registration_close (Time.now + 2.weeks)
    race_datetime (Time.now + 4.weeks)
    max_teams 10
    people_per_team 5

    factory :closed_race do
      registration_close (Time.now - 1.week)
    end
  end
end
