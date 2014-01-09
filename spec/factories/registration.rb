FactoryGirl.define do
  factory :registration do
    name 'Sample Team'
    description 'Sample Team Description'
    twitter '@sample'
  end

  trait :complete do
    with_team
    with_race
  end

  trait :with_team do
    association :team, :name => 'sample team (from registration factory)'
  end

  trait :with_race do
    association :race, :name => 'sample race (from registration factory)'
  end
end
