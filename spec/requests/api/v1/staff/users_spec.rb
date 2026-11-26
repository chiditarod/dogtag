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

    it "shows a refunder the detail" do
      api_login(FactoryBot.create(:refunder_user))
      get "/api/v1/staff/users/#{ada.id}"
      expect(response).to have_http_status(:ok)
      expect(json["user"]).to include("id" => ada.id, "can_edit" => false, "can_destroy" => false)
    end

    it "is 404 for an unknown id" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/users/0"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/staff/users/:id" do
    let(:admin) { FactoryBot.create(:admin_user) }

    def patch_user(user, attrs)
      patch "/api/v1/staff/users/#{user.id}", params: { user: attrs }, as: :json
    end

    it "lets an admin change another user's phone and roles, and keeps the admin signed in" do
      api_login(admin)
      patch_user(ada, phone: "773-555-0199", roles: ["operator"])

      expect(response).to have_http_status(:ok)
      expect(json["user"]).to include("id" => ada.id, "phone" => "773-555-0199", "roles" => ["operator"])
      expect(ada.reload).to be_is(:operator)
      expect(ada.phone).to eq("773-555-0199")
      expect(session_user_id).to eq(admin.id)
    end

    it "replaces the role set, and an empty list clears it" do
      api_login(admin)
      ada.update!(roles: [:operator, :refunder])
      patch_user(ada, roles: ["refunder"])
      expect(ada.reload.roles.map(&:to_s)).to eq(["refunder"])

      patch_user(ada, roles: [])
      expect(response).to have_http_status(:ok)
      expect(ada.reload.roles).to be_empty
    end

    it "leaves roles alone when the key is absent" do
      api_login(admin)
      ada.update!(roles: [:operator])
      patch_user(ada, first_name: "Adeline")
      expect(response).to have_http_status(:ok)
      expect(ada.reload.first_name).to eq("Adeline")
      expect(ada).to be_is(:operator)
    end

    it "lets an admin remove Admin from another admin" do
      other = FactoryBot.create(:admin_user)
      api_login(admin)
      patch_user(other, roles: ["operator"])
      expect(response).to have_http_status(:ok)
      expect(other.reload).not_to be_is(:admin)
    end

    it "refuses an admin removing their own Admin role" do
      api_login(admin)
      patch_user(admin, roles: ["operator"], first_name: "Changed")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["roles"]).to eq(["You can't remove your own Admin role"])
      expect(admin.reload).to be_is(:admin)
      expect(admin.first_name).not_to eq("Changed")
    end

    it "lets an admin edit their own details while keeping Admin" do
      api_login(admin)
      patch_user(admin, first_name: "Boss", roles: %w[admin operator])
      expect(response).to have_http_status(:ok)
      expect(admin.reload.first_name).to eq("Boss")
    end

    it "refuses an unknown role" do
      api_login(admin)
      patch_user(ada, roles: ["wizard"])
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["roles"]).to eq(["isn't a role: wizard"])
      expect(ada.reload.roles).to be_empty
    end

    it "refuses a taken email" do
      api_login(admin)
      patch_user(ada, email: zed.email)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]).to have_key("email")
      expect(ada.reload.email).to eq("ada@example.com")
    end

    it "does not change the password" do
      api_login(admin)
      expect { patch_user(ada, first_name: "Adeline", password: "newpassword1", password_confirmation: "newpassword1") }
        .not_to change { ada.reload.crypted_password }
    end

    %i[operator_user refunder_user].each do |factory|
      describe "as #{factory}" do
        let(:staff) { FactoryBot.create(factory) }
        before { api_login(staff) }

        it "cannot give themselves Admin" do
          patch_user(staff, roles: ["admin"])
          expect(response).to have_http_status(:forbidden)
          expect(staff.reload).not_to be_is(:admin)
        end

        it "cannot edit another user" do
          patch_user(ada, first_name: "Nope")
          expect(response).to have_http_status(:forbidden)
          expect(ada.reload.first_name).to eq("Ada")
        end

        it "is 403 for an unknown id, so ids are not probed" do
          patch "/api/v1/staff/users/0", params: { user: { first_name: "x" } }, as: :json
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    it "is 403 for a racer and 401 logged out" do
      patch_user(ada, first_name: "x")
      expect(response).to have_http_status(:unauthorized)

      api_login(ada)
      patch_user(ada, roles: ["admin"])
      expect(response).to have_http_status(:forbidden)
      expect(ada.reload.roles).to be_empty
    end

    it "is 404 for an unknown id as an admin" do
      api_login(admin)
      patch "/api/v1/staff/users/0", params: { user: { first_name: "x" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/staff/users/:id" do
    let(:admin) { FactoryBot.create(:admin_user) }

    it "deletes a bare user" do
      api_login(admin)
      delete "/api/v1/staff/users/#{zed.id}"
      expect(response).to have_http_status(:no_content)
      expect(User.exists?(zed.id)).to be(false)
    end

    it "refuses deleting yourself" do
      api_login(admin)
      delete "/api/v1/staff/users/#{admin.id}"
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("user_not_deletable")
      expect(json["error"]).to eq("You can't delete your own account.")
      expect(User.exists?(admin.id)).to be(true)
    end

    it "refuses deleting a team owner" do
      FactoryBot.create(:team, user: ada)
      api_login(admin)
      delete "/api/v1/staff/users/#{ada.id}"
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("user_not_deletable")
      expect(User.exists?(ada.id)).to be(true)
    end

    it "refuses deleting a user with a payment and no team" do
      requirement = FactoryBot.create(:payment_requirement)
      CompletedRequirement.create!(requirement: requirement, team: FactoryBot.create(:team), user: ada)
      expect(ada.teams).to be_empty
      api_login(admin)
      delete "/api/v1/staff/users/#{ada.id}"
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("user_not_deletable")
      expect(User.exists?(ada.id)).to be(true)
    end

    it "is 404 for an unknown id as an admin" do
      api_login(admin)
      delete "/api/v1/staff/users/0"
      expect(response).to have_http_status(:not_found)
    end

    it "is 401 logged out and 403 for a racer" do
      delete "/api/v1/staff/users/#{zed.id}"
      expect(response).to have_http_status(:unauthorized)

      api_login(ada)
      delete "/api/v1/staff/users/#{zed.id}"
      expect(response).to have_http_status(:forbidden)
      expect(User.exists?(zed.id)).to be(true)
    end

    %i[operator_user refunder_user].each do |factory|
      it "is 403 for #{factory}, on a real id and an unknown one" do
        api_login(FactoryBot.create(factory))
        delete "/api/v1/staff/users/#{zed.id}"
        expect(response).to have_http_status(:forbidden)
        expect(User.exists?(zed.id)).to be(true)

        delete "/api/v1/staff/users/0"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
