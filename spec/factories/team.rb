FactoryGirl.define do
  sequence :team_name do |n|
    "Team #{n}"
  end

  factory :team do
    name { generate :team_name }
  end

end
