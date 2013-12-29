FactoryGirl.define do
  factory :registration do
    name 'Team Registration'
    description 'Team Description'
    twitter '@foo'

    association :race, :name => 'awesome race'
    association :team, :name => 'awesome team'
  end
end
