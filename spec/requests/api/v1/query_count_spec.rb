require "spec_helper"

# Index endpoints should run a fixed number of queries, however many teams or races they list.
describe "API v1 index query counts", type: :request do
  let!(:user) { FactoryBot.create(:user) }

  def query_count
    count = 0
    callback = lambda do |*, payload|
      count += 1 unless payload[:cached] || %w[SCHEMA TRANSACTION].include?(payload[:name])
    end
    ActiveSupport::Notifications.subscribed(callback, "sql.active_record") { yield }
    count
  end

  def paid_team(finalized: false)
    race = FactoryBot.create(:race_with_jsonform)
    requirement = FactoryBot.create(:payment_requirement_with_tier, race: race)
    FactoryBot.create(:tier3, requirement: requirement)
    team = FactoryBot.create(:team, :with_people, user: user, race: race)
    requirement.complete(team.id, user, "amount" => 5000, "charge_id" => "ch_#{team.id}")
    team.update_column(:finalized, true) if finalized
    team
  end

  it "GET /api/v1/teams does not add queries per team" do
    api_login(user)
    paid_team
    one = query_count { get "/api/v1/teams" }
    paid_team(finalized: true)
    paid_team

    expect(query_count { get "/api/v1/teams" }).to eq(one)
    expect(json["teams"].size).to eq(3)
  end

  it "GET /api/v1/races does not add queries per race" do
    paid_team
    one = query_count { get "/api/v1/races" }
    paid_team(finalized: true)
    paid_team

    expect(query_count { get "/api/v1/races" }).to eq(one)
    expect(json["races"].size).to eq(3)
  end
end
