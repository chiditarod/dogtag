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
end
