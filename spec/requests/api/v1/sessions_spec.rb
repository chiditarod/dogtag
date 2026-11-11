require "spec_helper"

describe "API v1 sessions", type: :request do
  let!(:user) { FactoryBot.create(:user) }

  describe "POST /api/v1/session" do
    it "logs in with valid credentials" do
      post "/api/v1/session", params: { email: user.email, password: "12345678", remember_me: true }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json["user"]).to include("id" => user.id, "email" => user.email, "first_name" => user.first_name)
      expect(session_user_id).to eq(user.id)
    end

    it "rejects bad credentials" do
      post "/api/v1/session", params: { email: user.email, password: "nope" }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq("login_failed")
      expect(json["errors"]).to eq({})
      expect(session_user_id).to be_nil
    end

    it "switches to the new credentials when already logged in" do
      other = FactoryBot.create(:user)
      api_login(user)
      post "/api/v1/session", params: { email: other.email, password: "12345678" }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json["user"]["id"]).to eq(other.id)
      expect(session_user_id).to eq(other.id)
    end
  end

  describe "DELETE /api/v1/session" do
    it "logs out" do
      api_login(user)
      delete "/api/v1/session"
      expect(response).to have_http_status(:no_content)
      expect(session_user_id).to be_nil
    end

    it "returns 204 when not logged in" do
      delete "/api/v1/session"
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "GET /api/v1/me" do
    it "returns the current user" do
      api_login(user)
      get "/api/v1/me"
      expect(response).to have_http_status(:ok)
      expect(json["user"].keys).to match_array(%w[id first_name last_name email phone])
      expect(json["user"]["id"]).to eq(user.id)
    end

    it "returns 401 when not logged in" do
      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)
      expect(json).to eq("error" => "not_authenticated", "errors" => {})
    end
  end
end
