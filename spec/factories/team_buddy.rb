FactoryBot.define do

  factory :team_buddy do
    team
    buddy_team { association :team, race: team.race }
  end
end
