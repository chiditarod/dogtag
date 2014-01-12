
FactoryGirl.define do

  sequence :user_email do |n|
    "user_email#{n}@gmail.com"
  end

  factory :user do
    first_name 'Guy'
    last_name 'Smiley'
    phone '312-867-5309'
    email { generate(:user_email) }
    password '123456'
    password_confirmation '123456'

    factory :user2 do
      first_name 'Mr'
      last_name 'Anderson'
      email 'mr@anderson.com'
    end
  end

end
