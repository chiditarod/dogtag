FactoryBot.define do
  factory :sent_email do
    kind { "welcome" }
    sequence(:recipient) { |n| "recipient#{n}@example.com" }
    subject { "Welcome to CHIditarod" }
    status { "sent" }
    status_changed_at { Time.current }
  end
end
