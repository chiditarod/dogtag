FactoryGirl.define do
  factory :race do
    name 'Chiditarod'
    race_datetime DateTime.parse "2014-03-01 12:00:00"
    registration_close { race_datetime - 2.weeks }
    registration_open { registration_close - 4.weeks }
    max_teams 10
    people_per_team 5
  end
end
