FactoryGirl.define do

  sequence :s_first do |n|
    "First#{n}"
  end
  sequence :s_last do |n|
    "Last#{n}"
  end
  sequence :s_email do |n|
    "email#{n}@fake.com"
  end

  factory :user do
    first_name { generate :s_first }
    last_name { generate :s_last }
    phone '312-867-5309'
    email { generate :s_email }
    password '123456'
    password_confirmation '123456'

    factory :user2 do
      first_name 'Mr'
      last_name 'Anderson'
      email 'mr@anderson.com'
    end
  end

  trait :with_user do
    user
  end

end
