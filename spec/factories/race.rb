FactoryGirl.define do
  factory :race do
    name 'Chiditarod'
    race_datetime Time.now
    registration_close { race_datetime - 2.weeks }
    registration_open { registration_close - 4.weeks }
    max_teams 10
    people_per_team 5

    factory :race2 do
      name 'Chiditarod 2'
    end

  end
end
