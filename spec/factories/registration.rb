FactoryGirl.define do

  sequence :registration_name do |n|
    "Registration #{n}"
  end
  sequence :twitter_sequence do |n|
    "@twitter#{n}"
  end

  factory :registration do
    name { generate(:registration_name) }
    description 'This is a Sample Registration'
    twitter { generate(:twitter_sequence) }

    team
    race

    factory :finalized_registration do
      after(:build) do |reg|
        reg.stub(:finalized?).and_return true
      end
    end

    factory :registration_with_people do
      ignore do
        people_count 5
      end
      after(:create) do |registration, evaluator|
        create_list(:person, evaluator.people_count, registration: registration)
      end
    end
  end

end
