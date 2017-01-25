FactoryGirl.define do

  factory :user do
    sequence(:first_name) { |n| "First#{n}" }
    sequence(:last_name)  { |n| "Last#{n}" }
    sequence(:email)      { |n| "email#{n}@fake.com" }

    phone '312-867-5309'
    password '123456'
    password_confirmation '123456'

    factory :admin_user do
      roles [:admin]
    end

    factory :operator_user do
      roles [:operator]
    end

    factory :refunder_user do
      roles [:refunder]
    end

    factory :user2 do
      first_name 'Mr'
      last_name 'Anderson'
      email 'mr@anderson.com'
    end

    trait :with_classy_id do
      classy_id 123456
    end

    trait :with_stripe_account do
      sequence(:stripe_customer_id) { |n| "stripe_customer_#{n}" }
    end
  end
end
