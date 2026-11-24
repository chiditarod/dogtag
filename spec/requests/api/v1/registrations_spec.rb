require "spec_helper"

describe "API v1 registrations", type: :request do
  let!(:race) { FactoryBot.create(:race, max_teams: 10, people_per_team: 4) }
  let(:viewer) { FactoryBot.create(:user) }
  let(:path) { "/api/v1/races/#{race.id}/registrations" }

  def finalized_team(attrs = {})
    team = FactoryBot.create(:team, { race: race }.merge(attrs))
    team.update_columns(finalized: true)
    team
  end

  def ids(rows) = rows.map { |row| row["id"] }

  it "returns 401 when logged out" do
    get path

    expect(response).to have_http_status(:unauthorized)
    expect(json["error"]).to be_present
  end

  it "returns 404 for an unknown race" do
    api_login(viewer)

    get "/api/v1/races/0/registrations"

    expect(response).to have_http_status(:not_found)
    expect(json["error"]).to be_present
  end

  it "splits finalized and registering teams for a racer, with no staff data" do
    api_login(viewer)
    done = finalized_team
    started = FactoryBot.create(:team, race: race)
    started.update_columns(description: nil)

    get path

    expect(response).to have_http_status(:ok)
    expect(ids(json["finalized"])).to eq([done.id])
    expect(ids(json["registering"])).to eq([started.id])
    expect(json["finalized"] + json["registering"]).to all(include("staff" => nil))
    expect(json["emails"]).to be_nil
    expect(json["viewer"]).to eq("staff" => false, "can_email" => false)
    expect(json["registering"].first["description"]).to be_nil
    expect(json["race"]).to eq(
      "id" => race.id, "name" => race.name, "time_zone" => "America/Chicago", "max_teams" => 10,
      "finalized_count" => 1, "full" => false, "open_for_registration" => true
    )
    expect(json["registering_kind"]).to eq("registering")
    expect(json["filter_fields"]).to eq([])
  end

  it "orders finalized teams by team number, unnumbered last" do
    api_login(viewer)
    unnumbered = finalized_team
    seven = finalized_team(assigned_team_number: 7)
    three = finalized_team(assigned_team_number: 3)

    get path

    expect(ids(json["finalized"])).to eq([three.id, seven.id, unnumbered.id])
  end

  it "orders registering teams by most recent update when the race has room" do
    api_login(viewer)
    old = FactoryBot.create(:team, race: race, updated_at: Time.utc(2026, 1, 1))
    recent = FactoryBot.create(:team, race: race, updated_at: Time.utc(2026, 3, 1))

    get path

    expect(json["registering_kind"]).to eq("registering")
    expect(ids(json["registering"])).to eq([recent.id, old.id])
    expect(json["registering"].map { |row| row["waitlist_position"] }).to eq([nil, nil])
  end

  it "returns the waitlist in created order with positions when the race is full" do
    api_login(viewer)
    race.update_columns(max_teams: 1)
    finalized_team
    later = FactoryBot.create(:team, race: race, created_at: Time.utc(2026, 2, 1), updated_at: Time.utc(2026, 5, 1))
    earlier = FactoryBot.create(:team, race: race, created_at: Time.utc(2026, 1, 1), updated_at: Time.utc(2026, 1, 2))

    get path

    expect(json["race"]["full"]).to be(true)
    expect(json["registering_kind"]).to eq("waitlist")
    expect(ids(json["registering"])).to eq([earlier.id, later.id])
    expect(json["registering"].map { |row| row["waitlist_position"] }).to eq([1, 2])
    expect(json["finalized"].map { |row| row["waitlist_position"] }).to eq([nil])
  end

  it "marks the viewer's own teams and links only teams they may see" do
    api_login(viewer)
    mine = FactoryBot.create(:team, race: race, user: viewer)
    theirs = FactoryBot.create(:team, race: race)

    get path

    rows = json["registering"].index_by { |row| row["id"] }
    expect(rows[mine.id]).to include("mine" => true, "can_show" => true)
    expect(rows[theirs.id]).to include("mine" => false, "can_show" => false)
  end

  it "lets an owner delete only their own deletable team while registration is open" do
    api_login(viewer)
    mine = FactoryBot.create(:team, race: race, user: viewer)
    theirs = FactoryBot.create(:team, race: race)

    get path
    rows = json["registering"].index_by { |row| row["id"] }
    expect(rows[mine.id]["deletable"]).to be(true)
    expect(rows[theirs.id]["deletable"]).to be(false)

    race.update_columns(registration_close: 1.day.ago)
    get path
    expect(json["registering"].index_by { |row| row["id"] }[mine.id]["deletable"]).to be(false)
  end

  it "computes the row summary fields" do
    api_login(viewer)
    race.update_columns(experience_labels: ["Rookie", "Veteran"])
    team = FactoryBot.create(:team, race: race, experience: 1)
    FactoryBot.create(:person, team: team, experience: 3)
    FactoryBot.create(:person, team: team, experience: 4)

    get path

    row = json["registering"].first
    expect(row).to include("name" => team.name, "description" => team.description, "experience_label" => "Veteran",
                           "racer_years" => 7, "percent_complete" => team.percent_complete)
    expect(Time.zone.parse(row["created_at"])).to be_within(1.second).of(team.created_at)
  end

  it "gives a refunder staff columns but no emails" do
    api_login(FactoryBot.create(:refunder_user))
    enabled = FactoryBot.create(:payment_requirement_with_tier, race: race)
    refunded_one = FactoryBot.create(:payment_requirement_with_tier, race: race)
    team = finalized_team(assigned_team_number: 7, new_team: true)
    FactoryBot.create(:completed_requirement, requirement: enabled, team: team)
    FactoryBot.create(:completed_requirement, requirement: refunded_one, team: team, refunded_at: Time.utc(2026, 1, 1))
    other = FactoryBot.create(:team, race: race)

    get path

    expect(response).to have_http_status(:ok)
    row = json["finalized"].first
    expect(row["staff"]).to include("assigned_team_number" => 7, "payments_paid" => 1, "payments_total" => 2, "new_team" => true)
    expect(Time.zone.parse(row["staff"]["updated_at"])).to be_within(2.seconds).of(team.reload.updated_at)
    expect(json["registering"].first["staff"]).to include("assigned_team_number" => nil, "payments_paid" => 0, "new_team" => nil)
    expect(json["registering"].first["id"]).to eq(other.id)
    expect(json["emails"]).to be_nil
    expect(json["viewer"]).to eq("staff" => true, "can_email" => false)
  end

  it "gives an operator the bcc lists per tab, uniq and sorted" do
    api_login(FactoryBot.create(:operator_user))
    zed = FactoryBot.create(:user, email: "zed@example.com")
    amy = FactoryBot.create(:user, email: "amy@example.com")
    one = finalized_team(user: zed)
    finalized_team(user: zed)
    FactoryBot.create(:person, team: one, email: "racer-b@example.com")
    FactoryBot.create(:person, team: one, email: "racer-a@example.com")
    FactoryBot.create(:person, team: one).update_columns(email: "")
    waiting = FactoryBot.create(:team, race: race, user: amy)
    FactoryBot.create(:person, team: waiting, email: "waiting@example.com")

    get path

    expect(json["viewer"]).to eq("staff" => true, "can_email" => true)
    expect(json["emails"]).to eq(
      "to" => "dogtag@chiditarod.org",
      "finalized" => { "owners" => ["zed@example.com"], "racers" => ["racer-a@example.com", "racer-b@example.com"] },
      "registering" => { "owners" => ["amy@example.com"], "racers" => ["waiting@example.com"] }
    )
    expect(json["registering"].first["deletable"]).to be(true)
  end

  it "still returns the page when a team's user row is gone" do
    api_login(FactoryBot.create(:operator_user))
    owner = FactoryBot.create(:user, email: "owner@example.com")
    kept = finalized_team(user: owner)
    orphan = finalized_team
    orphan.update_column(:user_id, 0)

    get path

    expect(response).to have_http_status(:ok)
    expect(ids(json["finalized"])).to contain_exactly(kept.id, orphan.id)
    expect(json["emails"]["finalized"]["owners"]).to eq(["owner@example.com"])
  end

  it "labels filter fields and normalizes answers" do
    api_login(viewer)
    race.update_columns(filter_field: "racer-type,racing-for-time,colors,nested")
    team = FactoryBot.create(:team, race: race)
    team.update_columns(jsonform: { "racer-type" => "Racer", "racing-for-time" => false, "colors" => ["red", "blue"], "nested" => { "a" => 1 } }.to_json)
    broken = FactoryBot.create(:team, race: race)
    broken.update_columns(jsonform: "{not json")

    get path

    expect(json["filter_fields"]).to eq([
      { "key" => "racer-type", "label" => "Racer type" },
      { "key" => "racing-for-time", "label" => "Racing for time" },
      { "key" => "colors", "label" => "Colors" },
      { "key" => "nested", "label" => "Nested" }
    ])
    rows = json["registering"].index_by { |row| row["id"] }
    expect(rows[team.id]["answers"]).to eq("racer-type" => "Racer", "racing-for-time" => "No", "colors" => "red, blue", "nested" => nil)
    expect(rows[broken.id]["answers"]).to eq("racer-type" => nil, "racing-for-time" => nil, "colors" => nil, "nested" => nil)
  end

  it "returns empty filter fields when the race has none" do
    api_login(viewer)
    FactoryBot.create(:team, race: race)

    get path

    expect(json["filter_fields"]).to eq([])
    expect(json["registering"].first["answers"]).to eq({})
  end
end
