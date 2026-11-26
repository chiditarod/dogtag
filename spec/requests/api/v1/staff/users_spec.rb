require "spec_helper"

describe "API v1 staff users", type: :request do
  let!(:ada) { FactoryBot.create(:user, first_name: "Ada", last_name: "Racer", email: "ada@example.com", phone: "312-555-0101") }
  let!(:zed) { FactoryBot.create(:user, first_name: "Zed", last_name: "Aardvark", email: "zed@example.com") }

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/users"
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/staff/users/#{ada.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "is 403 for a racer, on the list and on their own record" do
      api_login(ada)
      get "/api/v1/staff/users"
      expect(response).to have_http_status(:forbidden)
      expect(json["users"]).to be_nil
      get "/api/v1/staff/users/#{ada.id}"
      expect(response).to have_http_status(:forbidden)
      expect(json["user"]).to be_nil
    end
  end

  describe "GET /api/v1/staff/users" do
    %i[refunder_user operator_user].each do |factory|
      it "lists users by last name for #{factory}" do
        staff = FactoryBot.create(factory, last_name: "Zzz")
        api_login(staff)
        get "/api/v1/staff/users"

        expect(response).to have_http_status(:ok)
        expect(json["users"].map { |user| user["id"] }).to eq([zed.id, ada.id, staff.id])
        expect(json["meta"]).to eq("page" => 1, "per_page" => 35, "total_count" => 3, "total_pages" => 1)
        expect(json["users"].last["roles"]).to eq([factory.to_s.delete_suffix("_user")])
        expect(json["users"].first.keys).to match_array(%w[id first_name last_name email phone roles teams])
        expect(json["users"][1]).to include("id" => ada.id, "first_name" => "Ada", "email" => "ada@example.com",
          "phone" => "312-555-0101", "roles" => [], "teams" => [])
      end
    end

    it "shows each team with its race year, newest race first" do
      api_login(FactoryBot.create(:operator_user))
      older = FactoryBot.create(:race, name: "Old Race", race_datetime: 2.years.from_now)
      newer = FactoryBot.create(:race, name: "New Race", race_datetime: 3.years.from_now)
      FactoryBot.create(:team, user: ada, race: older, name: "First")
      second = FactoryBot.create(:team, user: ada, race: newer, name: "Second")
      get "/api/v1/staff/users"

      teams = json["users"].find { |user| user["id"] == ada.id }["teams"]
      expect(teams.map { |team| team["name"] }).to eq(%w[Second First])
      expect(teams.first).to eq("id" => second.id, "name" => "Second",
        "race" => { "id" => newer.id, "name" => "New Race", "year" => newer.local(newer.race_datetime).year })
    end

    it "searches every word and pages" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/users", params: { q: "ada racer" }
      expect(json["users"].map { |user| user["id"] }).to eq([ada.id])
      expect(json["meta"]["total_count"]).to eq(1)

      get "/api/v1/staff/users", params: { q: "ada aardvark" }
      expect(json["users"]).to eq([])

      get "/api/v1/staff/users", params: { page: "2" }
      expect(json["users"]).to eq([])
      expect(json["meta"]["page"]).to eq(2)
    end
  end

  describe "GET /api/v1/staff/users/:id" do
    let!(:race) { FactoryBot.create(:race, name: "The Race") }
    let!(:team) { FactoryBot.create(:team, user: ada, race: race, name: "Doge Sled") }

    it "shows the operator the detail without edit or delete" do
      operator = FactoryBot.create(:operator_user)
      api_login(operator)
      get "/api/v1/staff/users/#{ada.id}"

      expect(response).to have_http_status(:ok)
      expect(json["user"]).to include("id" => ada.id, "email" => "ada@example.com", "roles" => [],
        "can_edit" => false, "can_destroy" => false, "is_self" => false, "delete_blocker" => nil)
      expect(Time.zone.parse(json["user"]["created_at"])).to be_within(1.second).of(ada.created_at)
      expect(json["user"]["teams"]).to eq([{ "id" => team.id, "name" => "Doge Sled", "finalized" => false,
        "assigned_team_number" => nil, "percent_complete" => team.percent_complete,
        "race" => { "id" => race.id, "name" => "The Race", "year" => race.local(race.race_datetime).year } }])
    end

    it "tells an admin who may delete, and what blocks it" do
      api_login(FactoryBot.create(:admin_user))
      get "/api/v1/staff/users/#{ada.id}"
      expect(json["user"]).to include("can_edit" => true, "can_destroy" => true, "is_self" => false)
      expect(json["user"]["delete_blocker"]).to start_with("Owns 1 team")

      get "/api/v1/staff/users/#{zed.id}"
      expect(json["user"]).to include("can_destroy" => true, "delete_blocker" => nil)
    end

    it "marks the admin's own record" do
      admin = FactoryBot.create(:admin_user)
      api_login(admin)
      get "/api/v1/staff/users/#{admin.id}"
      expect(json["user"]).to include("is_self" => true, "delete_blocker" => "You can't delete your own account.")
    end

    it "is 404 for an unknown id" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/users/0"
      expect(response).to have_http_status(:not_found)
    end
  end
end
