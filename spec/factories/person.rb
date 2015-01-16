FactoryGirl.define do
  factory :person do
    first_name "Bill"
    last_name "Murray"
    email "bill@ghostbusters.com"
    phone "123-345-6789"
    experience 3
    zipcode '12345'
  end
end
