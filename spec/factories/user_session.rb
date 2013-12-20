FactoryGirl.define do
  factory :user_session do
    email 'guy@smiley.com'
    password '123456'
    remember_me '1'
  end
end
