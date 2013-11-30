FactoryGirl.define do
  factory :registration do
    name 'Team Registration'
    description 'Team Description'
    twitter '@foo'

    association :race
    association :team
  end
end
