require "spec_helper"

describe "API v1 CSRF", type: :request do
  around do |example|
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = original
  end

  it "returns a token" do
    get "/api/v1/csrf"
    expect(response).to have_http_status(:ok)
    expect(json["token"]).to be_present
  end

  it "rejects a POST without the token" do
    post "/api/v1/password_resets", params: { email: "a@b.com" }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(json["error"]).to eq("invalid_csrf")
    expect(json["errors"]).to eq({})
  end

  it "accepts a POST with the token in X-CSRF-Token" do
    get "/api/v1/csrf"
    token = json["token"]
    post "/api/v1/password_resets", params: { email: "a@b.com" }, as: :json, headers: { "X-CSRF-Token" => token }
    expect(response).to have_http_status(:accepted)
  end
end
