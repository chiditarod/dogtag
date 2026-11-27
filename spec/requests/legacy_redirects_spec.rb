require "spec_helper"

describe "Legacy URLs that moved to the SPA", type: :request do
  def expect_moved(path, to)
    get path
    expect(response).to have_http_status(:moved_permanently)
    expect(response).to redirect_to(to)
  end

  it "/ moves to /register" do
    expect_moved("/", "/register")
  end

  it "/ moves to /register for a signed-in racer" do
    api_login(FactoryBot.create(:user))
    expect_moved("/", "/register")
  end

  it "POST / is still a 404" do
    post "/"
    expect(response).to have_http_status(:not_found)
  end

  {
    "/account" => "/register/account",
    "/account/edit" => "/register/account",
    "/users/7" => "/register/account",
    "/users/7/edit" => "/register/account",
    "/users/new" => "/register/signup",
    "/login" => "/register/login",
    "/user_session/new" => "/register/login",
    "/password_resets/new" => "/register/forgot-password"
  }.each do |path, target|
    it "#{path} moves to #{target}" do
      expect_moved(path, target)
    end
  end

  it "a password reset link moves to the SPA reset page with its token" do
    user = FactoryBot.create(:user)
    user.reset_perishable_token!
    expect_moved("/password_resets/#{user.perishable_token}/edit", "/register/reset-password/#{user.perishable_token}")
  end

  it "a junk user id or token is not redirected" do
    get "/users/abc"
    expect(response).to have_http_status(:not_found)
    get "/password_resets/a.b%20c/edit"
    expect(response).to have_http_status(:not_found)
  end

  describe "team URLs" do
    it "/teams moves to the SPA team list" do
      expect_moved("/teams", "/register/teams")
    end

    it "/teams/new moves to the SPA new-team page for a numeric race id" do
      expect_moved("/teams/new?race_id=12", "/register/races/12/teams/new")
    end

    it "/teams/new without a usable race id moves to /register" do
      expect_moved("/teams/new", "/register")
      expect_moved("/teams/new?race_id=abc", "/register")
    end

    [
      "/teams/34", "/teams/34/edit", "/teams/34/people/new", "/teams/34/people/56/edit", "/teams/34/questions"
    ].each do |path|
      it "#{path} moves to the SPA team page, logged out or as the owner" do
        expect_moved(path, "/register/teams/34")
        api_login(FactoryBot.create(:user))
        expect_moved(path, "/register/teams/34")
      end
    end

    it "a junk team id is not redirected" do
      get "/teams/abc"
      expect(response).to have_http_status(:not_found)
    end

    it "GET /teams/search still answers staff JSON" do
      # The search parameterizes the query ("Two Words" becomes "two-words"), so use a one-word name.
      team = FactoryBot.create(:team, name: "Zephyrcarts")
      api_login(FactoryBot.create(:operator_user))
      get "/teams/search", params: { q: team.name }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq([{ "id" => team.id, "text" => "#{team.name} - #{team.race.name}" }])
    end

    it "the old team, payment and captain actions are 404" do
      post "/teams"
      expect(response).to have_http_status(:not_found)
      post "/charges"
      expect(response).to have_http_status(:not_found)
      post "/charges/ch_1/refund"
      expect(response).to have_http_status(:not_found)
      post "/mock_payment"
      expect(response).to have_http_status(:not_found)
      delete "/teams/34"
      expect(response).to have_http_status(:not_found)
      put "/teams/34/captain"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "staff user routes that stay" do
    let(:admin) { FactoryBot.create(:admin_user) }

    before { api_login(admin) }

    it "GET /users still lists users" do
      get "/users"
      expect(response).to have_http_status(:ok)
    end

    it "GET /users/search still answers JSON" do
      get "/users/search", params: { q: "x" }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to be_an(Array)
    end

    it "DELETE /users/:id still deletes a user with no teams" do
      user = FactoryBot.create(:user)
      delete "/users/#{user.id}"
      expect(response).to redirect_to(users_path)
      expect(User.exists?(user.id)).to be false
    end
  end

  describe "the old forms are gone" do
    it "POST /users, POST /user_session and PATCH /users/:id are 404" do
      post "/users"
      expect(response).to have_http_status(:not_found)
      post "/user_session"
      expect(response).to have_http_status(:not_found)
      patch "/users/7"
      expect(response).to have_http_status(:not_found)
    end
  end
end
