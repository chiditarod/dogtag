FactoryGirl.define do
  factory :race do
    name 'Chiditarod'
    race_datetime DateTime.parse "2014-03-01 12:00:00"
    registration_open DateTime.parse "2014-01-15 00:00:00"
    registration_close DateTime.parse "2014-02-15 00:00:00"
    max_teams 10
    people_per_team 5
  end
end
