require "spec_helper"

RSpec.describe "Login page", type: :request do
  it "labels the email and password fields" do
    get "/user_session/new"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('<label class="sr-only" for="user_session_email">Email</label>')
    expect(response.body).to include('<label class="sr-only" for="user_session_password">Password</label>')
  end
end
