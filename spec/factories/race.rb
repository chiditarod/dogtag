FactoryGirl.define do
  factory :race do
    name 'Chiditarod'
    race_datetime Time.now
    registration_close { race_datetime - 2.weeks }
    registration_open { registration_close - 4.weeks }
    max_teams 10
    people_per_team 5

    #factory :full_race do
      #after_create do |race|
        #max_teams.times do |x|
          #puts x
          #FactoryGirl.create(:registration, name: "Team#{x}", twitter: "@x", race: race)
        #end
      #end
    #end

  end
end
