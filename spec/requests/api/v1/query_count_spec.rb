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

  it "GET /api/v1/staff/payments does not add queries per row" do
    api_login(FactoryBot.create(:refunder_user))
    race = FactoryBot.create(:race)
    requirement = FactoryBot.create(:payment_requirement_with_tier, race: race)
    add_payment = lambda do |n|
      team = FactoryBot.create(:team, race: race)
      FactoryBot.create(:person, team: team)
      FactoryBot.create(:completed_requirement, requirement: requirement, team: team, charge_id: "ch_#{n}", amount_cents: 5000,
        refunded_at: (Time.current if n.even?), refunded_by: (FactoryBot.create(:refunder_user) if n.even?))
    end
    add_payment.call(2) # refunded, so the baseline already loads who refunded
    one = query_count { get "/api/v1/staff/payments" }
    [1, 3, 4, 5].each { |n| add_payment.call(n) }

    expect(query_count { get "/api/v1/staff/payments" }).to eq(one)
    expect(json["payments"].size).to eq(5)
  end

  it "GET /api/v1/staff/races does not add queries per race" do
    api_login(FactoryBot.create(:operator_user))
    add_race = lambda do
      race = FactoryBot.create(:race)
      requirement = FactoryBot.create(:payment_requirement_with_tier, race: race)
      FactoryBot.create(:tier3, requirement: requirement)
      FactoryBot.create(:finalized_team, race: race)
    end
    add_race.call
    one = query_count { get "/api/v1/staff/races" }
    2.times { add_race.call }

    expect(query_count { get "/api/v1/staff/races" }).to eq(one)
    expect(json["races"].size).to eq(3)
  end

  it "GET /api/v1/staff/users does not add queries per user or team" do
    api_login(FactoryBot.create(:operator_user))
    owner = FactoryBot.create(:user)
    2.times { FactoryBot.create(:team, user: owner, race: FactoryBot.create(:race)) }
    one = query_count { get "/api/v1/staff/users" }
    3.times do
      other = FactoryBot.create(:user)
      2.times { FactoryBot.create(:team, user: other, race: FactoryBot.create(:race)) }
    end

    expect(query_count { get "/api/v1/staff/users" }).to eq(one)
    expect(json["users"].sum { |user| user["teams"].size }).to eq(8)
  end

  it "GET /api/v1/staff/races/:id/requirements does not add queries per fee" do
    api_login(FactoryBot.create(:operator_user))
    race = FactoryBot.create(:race)
    add_fee = lambda do
      requirement = FactoryBot.create(:payment_requirement_with_tier, race: race)
      FactoryBot.create(:tier3, requirement: requirement)
      team = FactoryBot.create(:team, race: race)
      FactoryBot.create(:completed_requirement, requirement: requirement, team: team, charge_id: "ch_#{requirement.id}", amount_cents: 5000)
    end
    add_fee.call
    one = query_count { get "/api/v1/staff/races/#{race.id}/requirements" }
    2.times { add_fee.call }

    expect(query_count { get "/api/v1/staff/races/#{race.id}/requirements" }).to eq(one)
    expect(json["requirements"].size).to eq(3)
  end

  it "GET /api/v1/races/:id/registrations does not add queries per team" do
    api_login(FactoryBot.create(:admin_user))
    race = FactoryBot.create(:race_with_jsonform_and_filter_field, max_teams: 50)
    requirement = FactoryBot.create(:payment_requirement_with_tier, race: race)
    add_team = lambda do |finalized|
      team = FactoryBot.create(:team, :with_people, race: race)
      requirement.complete(team.id, team.user, "amount" => 5000, "charge_id" => "ch_#{team.id}")
      team.update_column(:finalized, true) if finalized
    end
    add_team.call(true)
    add_team.call(false)
    one = query_count { get "/api/v1/races/#{race.id}/registrations" }
    2.times { add_team.call(true) }
    2.times { add_team.call(false) }

    expect(query_count { get "/api/v1/races/#{race.id}/registrations" }).to eq(one)
    expect(json["finalized"].size).to eq(3)
    expect(json["registering"].size).to eq(3)
  end

  it "GET /api/v1/teams/:id/buddy_options does not add queries per team" do
    api_login(user)
    race = FactoryBot.create(:race)
    mine = FactoryBot.create(:team, user: user, race: race)
    FactoryBot.create(:team, race: race)
    one = query_count { get "/api/v1/teams/#{mine.id}/buddy_options" }
    FactoryBot.create_list(:team, 3, race: race)

    expect(query_count { get "/api/v1/teams/#{mine.id}/buddy_options" }).to eq(one)
    expect(json["teams"].size).to eq(4)
  end
end
