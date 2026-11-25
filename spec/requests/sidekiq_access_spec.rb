require "spec_helper"

describe "Sidekiq dashboard access", type: :request do
  before do
    allow(Sidekiq::Web).to receive(:call).and_return([200, { "content-type" => "text/plain" }, ["sidekiq"]])
  end

  it "returns 404 to a logged-out visitor" do
    get "/sidekiq"
    expect(response).to have_http_status(:not_found)
  end

  it "returns 404 to a racer, a refunder and an operator" do
    [:user, :refunder_user, :operator_user].each do |kind|
      api_login(FactoryBot.create(kind))
      get "/sidekiq"
      expect(response).to have_http_status(:not_found)
    end
  end

  it "returns 404 on sub-paths and posts for a non-admin" do
    api_login(FactoryBot.create(:operator_user))
    get "/sidekiq/retries"
    expect(response).to have_http_status(:not_found)
    post "/sidekiq/queues/default"
    expect(response).to have_http_status(:not_found)
  end

  it "lets an admin in" do
    api_login(FactoryBot.create(:admin_user))
    get "/sidekiq"
    expect(response).to have_http_status(:ok)
    expect(response.body).to eq("sidekiq")
    get "/sidekiq/queues"
    expect(response).to have_http_status(:ok)
  end

  it "does not touch the admin's reset token or last request time" do
    admin = FactoryBot.create(:admin_user)
    api_login(admin)
    before_values = admin.reload.slice(:perishable_token, :last_request_at)
    2.times { get "/sidekiq" }
    expect(response).to have_http_status(:ok)
    expect(admin.reload.slice(:perishable_token, :last_request_at)).to eq(before_values)
  end

  it "lets an admin in through the remember-me cookie alone" do
    https! # Authlogic marks its credentials cookie secure
    admin = FactoryBot.create(:admin_user)
    api_login(admin, remember_me: true)
    expect(cookies["user_credentials"]).to be_present
    cookies.delete("_dogtag_session")
    get "/sidekiq"
    expect(response).to have_http_status(:ok)
  end

  it "returns 404, not 500, for a garbage session cookie" do
    cookies["_dogtag_session"] = "garbage"
    get "/sidekiq"
    expect(response).to have_http_status(:not_found)
  end
end
