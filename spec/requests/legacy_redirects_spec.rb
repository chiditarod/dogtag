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
end
