FactoryGirl.define do
  sequence :race_name do |n|
    "Race #{n}"
  end

  factory :race do
    name { generate(:race_name) }
    registration_open (Time.now - 2.weeks)
    registration_close (Time.now + 2.weeks)
    race_datetime (Time.now + 4.weeks)
    max_teams 3
    people_per_team 5

    factory :closed_race do
      registration_close (Time.now - 1.week)
    end

    #factory :full_race do
      #ignore do
        #regs_to_make 3
      #end
      #after(:create) do |race, eval|
        #create_list(:finalized_registration, eval.regs_to_make, race: race)
      #end
    #end

  end
end
