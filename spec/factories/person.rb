FactoryGirl.define do
  factory :person do
    first_name "Bill"
    last_name "Murray"
    email "bill@ghostbusters.com"
    phone "123-345-6789"

    factory :person2 do
      first_name "Dan"
      last_name "Akroyd"
      email "dan@ghostbusters.com"
      phone "312-867-5209"
    end

    trait :with_registration do
      association :registration, :complete
    end

  end
end
