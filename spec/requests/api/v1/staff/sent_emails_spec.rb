require "spec_helper"

describe "API v1 staff sent emails", type: :request do
  let(:operator) { FactoryBot.create(:operator_user) }
  let!(:team) { FactoryBot.create(:team, name: "Cart Pushers") }

  def ids
    json["sent_emails"].map { |row| row["id"] }
  end

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/sent_emails"
      expect(response).to have_http_status(:unauthorized)
    end

    it "is 403 for a racer and a refunder" do
      [FactoryBot.create(:user), FactoryBot.create(:refunder_user)].each do |user|
        api_login(user)
        get "/api/v1/staff/sent_emails"
        expect(response).to have_http_status(:forbidden)
        expect(json["sent_emails"]).to be_nil
      end
    end
  end

  describe "GET /api/v1/staff/sent_emails" do
    before { api_login(operator) }

    it "lists newest first with the team and filter options" do
      old = FactoryBot.create(:sent_email, created_at: 2.days.ago, team: team)
      failed = FactoryBot.create(:sent_email, created_at: 1.day.ago, status: "failed", error: "boom", kind: "refund", team_id: nil)
      get "/api/v1/staff/sent_emails"

      expect(response).to have_http_status(:ok)
      expect(ids).to eq([failed.id, old.id])
      expect(json["sent_emails"].last).to eq(
        "id" => old.id, "created_at" => json["sent_emails"].last["created_at"], "kind" => "welcome",
        "recipient" => old.recipient, "subject" => "Welcome to CHIditarod", "status" => "sent",
        "status_changed_at" => json["sent_emails"].last["status_changed_at"], "error" => nil,
        "team" => { "id" => team.id, "name" => "Cart Pushers" }
      )
      expect(json["sent_emails"].first).to include("error" => "boom", "team" => nil)
      expect(json["meta"]).to eq("page" => 1, "per_page" => 25, "total_count" => 2, "total_pages" => 1)
      expect(json["filters"]).to eq("team" => nil, "kinds" => SentEmail::KINDS, "statuses" => SentEmail::FILTER_STATUSES)
    end

    it "filters by status, including statuses the menu no longer offers" do
      FactoryBot.create(:sent_email)
      failed = FactoryBot.create(:sent_email, status: "failed", error: "SMTP down")
      old = FactoryBot.create(:sent_email, status: "delivered")

      get "/api/v1/staff/sent_emails", params: { status: "failed" }
      expect(ids).to eq([failed.id])
      expect(json["sent_emails"].first["error"]).to eq("SMTP down")

      get "/api/v1/staff/sent_emails", params: { status: "delivered" }
      expect(ids).to eq([old.id])

      get "/api/v1/staff/sent_emails", params: { status: "nonsense" }
      expect(ids.size).to eq(3)
    end

    it "filters by kind" do
      FactoryBot.create(:sent_email, kind: "refund")
      welcome = FactoryBot.create(:sent_email, kind: "welcome")
      get "/api/v1/staff/sent_emails", params: { kind: "welcome" }
      expect(ids).to eq([welcome.id])
    end

    it "filters by recipient, ignoring case and treating % literally" do
      ada = FactoryBot.create(:sent_email, recipient: "ada@example.com")
      FactoryBot.create(:sent_email, recipient: "zed@example.com")
      get "/api/v1/staff/sent_emails", params: { recipient: "ADA" }
      expect(ids).to eq([ada.id])

      get "/api/v1/staff/sent_emails", params: { recipient: "%" }
      expect(ids).to be_empty
    end

    it "filters by team and reports the team, or an unknown id with no name" do
      mine = FactoryBot.create(:sent_email, team: team)
      FactoryBot.create(:sent_email, team: FactoryBot.create(:team))
      get "/api/v1/staff/sent_emails", params: { team_id: team.id }
      expect(ids).to eq([mine.id])
      expect(json["filters"]["team"]).to eq("id" => team.id, "name" => "Cart Pushers")

      get "/api/v1/staff/sent_emails", params: { team_id: 999_999 }
      expect(ids).to be_empty
      expect(json["filters"]["team"]).to eq("id" => 999_999, "name" => nil)

      get "/api/v1/staff/sent_emails", params: { team_id: "99999999999999999999" }
      expect(response).to have_http_status(:ok)
      expect(ids).to be_empty
    end

    it "ignores a team_id that is not a positive integer" do
      FactoryBot.create(:sent_email, team: team)
      ["abc", "0", "-3", "1x"].each do |bad|
        get "/api/v1/staff/sent_emails", params: { team_id: bad }
        expect(ids.size).to eq(1)
        expect(json["filters"]["team"]).to be_nil
      end
    end

    it "pages by 25 and clamps a bad page" do
      26.times { FactoryBot.create(:sent_email) }
      get "/api/v1/staff/sent_emails", params: { page: 2 }
      expect(ids.size).to eq(1)
      expect(json["meta"]).to include("page" => 2, "total_count" => 26, "total_pages" => 2)

      get "/api/v1/staff/sent_emails", params: { page: "99999999999999999999" }
      expect(response).to have_http_status(:ok)
      expect(json["meta"]["page"]).to eq(Users::StaffSearch::MAX_PAGE)
      expect(ids).to be_empty
    end

    it "shows no team for a row whose team was deleted" do
      FactoryBot.create(:sent_email, team_id: 424_242)
      get "/api/v1/staff/sent_emails"
      expect(json["sent_emails"].first["team"]).to be_nil
    end
  end
end
