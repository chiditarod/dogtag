require "spec_helper"

describe "API v1 password resets", type: :request do
  let!(:user) { FactoryBot.create(:user) }

  before { Workers::PasswordResetEmail.jobs.clear }

  it "enqueues a reset email for an existing user" do
    post "/api/v1/password_resets", params: { email: user.email.upcase }, as: :json
    expect(response).to have_http_status(:accepted)
    expect(json).to eq({})
    expect(Workers::PasswordResetEmail.jobs.size).to eq(1)
    expect(Workers::PasswordResetEmail.jobs.first["args"].first).to include("user_id" => user.id)
  end

  it "returns 202 for an unknown email without enqueuing" do
    post "/api/v1/password_resets", params: { email: "nobody@example.com" }, as: :json
    expect(response).to have_http_status(:accepted)
    expect(Workers::PasswordResetEmail.jobs.size).to eq(0)
  end

  it "returns 202 when the email is missing" do
    post "/api/v1/password_resets", params: {}, as: :json
    expect(response).to have_http_status(:accepted)
    expect(Workers::PasswordResetEmail.jobs.size).to eq(0)
  end

  it "uses the configured host, not the request Host header, for the reset link" do
    host! "evil.example"
    post "/api/v1/password_resets", params: { email: user.email }, as: :json
    host = Workers::PasswordResetEmail.jobs.first["args"].first["host"]
    expect(host).to eq(ActionMailer::Base.default_url_options[:host])
    expect(host).not_to include("evil.example")
  end

  describe "with a reset token" do
    let(:token) do
      user.reset_perishable_token!
      user.perishable_token
    end
    let(:new_password) { { password: "newpassword456", password_confirmation: "newpassword456" } }

    it "shows the email for a valid token" do
      get "/api/v1/password_resets/#{token}"
      expect(response).to have_http_status(:ok)
      expect(json).to eq("email" => user.email)
    end

    it "404s an unknown token" do
      get "/api/v1/password_resets/nope"
      expect(response).to have_http_status(:not_found)
    end

    it "404s a token older than 3 hours" do
      token
      Timecop.travel(3.hours.from_now + 1.minute) do
        get "/api/v1/password_resets/#{token}"
        expect(response).to have_http_status(:not_found)
      end
    end

    it "sets the password and logs the user in" do
      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:ok)
      expect(json["user"]["id"]).to eq(user.id)
      expect(session_user_id).to eq(user.id)
      expect(user.reload.valid_password?("newpassword456")).to be(true)
    end

    it "is single use" do
      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:ok)

      put "/api/v1/password_resets/#{token}", params: new_password.merge(password: "another789pw", password_confirmation: "another789pw"), as: :json
      expect(response).to have_http_status(:not_found)
      expect(user.reload.valid_password?("newpassword456")).to be(true)
    end

    it "keeps the token valid when the same user is logged in and the SPA calls /me" do
      api_login(user)
      user.reset_perishable_token!
      token = user.perishable_token

      get "/api/v1/me"
      expect(response).to have_http_status(:ok)

      get "/api/v1/password_resets/#{token}"
      expect(response).to have_http_status(:ok)
      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:ok)
      expect(user.reload.valid_password?("newpassword456")).to be(true)

      put "/api/v1/password_resets/#{token}", params: new_password.merge(password: "another789pw", password_confirmation: "another789pw"), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "keeps the token valid after an authenticated legacy page request" do
      post "/user_session", params: { user_session: { email: user.email, password: "12345678" } }
      expect(response).to have_http_status(:found)
      user.reset_perishable_token!
      token = user.perishable_token

      get "/teams"
      expect(response).to have_http_status(:ok)
      get "/api/v1/password_resets/#{token}"
      expect(response).to have_http_status(:ok)
    end

    it "clears a brute-force lockout, logs the user in, and lets them log in again" do
      user.update_columns(failed_login_count: 15)
      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:ok)
      expect(session_user_id).to eq(user.id)
      expect(user.reload.failed_login_count).to eq(0)

      delete "/api/v1/session"
      post "/api/v1/session", params: { email: user.email, password: "newpassword456" }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "does not claim success when the session cannot be created" do
      allow(UserSession).to receive(:create).and_return(instance_double(UserSession, persisted?: false))
      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["errors"]["base"]).to eq([I18n.t("api.errors.reset_login_failed")])
      expect(user.reload.valid_password?("newpassword456")).to be(true)
    end

    it "logs in as the token's user even when someone else is logged in" do
      other = FactoryBot.create(:user)
      api_login(other)
      expect(session_user_id).to eq(other.id)

      put "/api/v1/password_resets/#{token}", params: new_password, as: :json
      expect(response).to have_http_status(:ok)
      expect(session_user_id).to eq(user.id)
    end

    it "rejects blank, short and mismatched passwords" do
      [
        { password: "", password_confirmation: "" },
        { password: "short", password_confirmation: "short" },
        { password: "newpassword456", password_confirmation: "different456" }
      ].each do |attrs|
        put "/api/v1/password_resets/#{token}", params: attrs, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"].keys & %w[password password_confirmation]).not_to be_empty
        expect(user.reload.valid_password?("12345678")).to be(true)
      end
    end
  end
end
