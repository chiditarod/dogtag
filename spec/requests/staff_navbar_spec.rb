require "spec_helper"

describe "Legacy navbar Payments link", type: :request do
  def payments_links
    Nokogiri::HTML(response.body).css(%(.navbar a[href="/register/staff/payments"]))
  end

  %i[admin_user operator_user refunder_user].each do |factory|
    it "links Payments to the SPA staff page for #{factory}" do
      api_login(FactoryBot.create(factory))
      get "/races"

      expect(response).to have_http_status(:ok)
      expect(payments_links.map { |a| a.text.strip }).to eq(["Payments"])
    end
  end

  it "does not show Payments to a racer" do
    api_login(FactoryBot.create(:user))
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(payments_links).to be_empty
  end

  it "does not show Payments when logged out" do
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(payments_links).to be_empty
  end
end

describe "Legacy navbar Races link", type: :request do
  def races_links
    Nokogiri::HTML(response.body).css(%(.navbar a[href="/register/staff/races"]))
  end

  %i[admin_user operator_user].each do |factory|
    it "links Races to the SPA staff page for #{factory}" do
      api_login(FactoryBot.create(factory))
      get "/races"

      expect(response).to have_http_status(:ok)
      expect(races_links.map { |a| a.text.strip }).to eq(["Races"])
    end
  end

  it "does not show Races to a refunder" do
    api_login(FactoryBot.create(:refunder_user))
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(races_links).to be_empty
  end

  it "does not show Races to a racer" do
    api_login(FactoryBot.create(:user))
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(races_links).to be_empty
  end

  it "does not show Races when logged out" do
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(races_links).to be_empty
  end
end

describe "Legacy navbar Users and Emails links", type: :request do
  def links_to(path)
    Nokogiri::HTML(response.body).css(%(.navbar a[href="#{path}"]))
  end

  it "links Users but not Emails for a refunder" do
    api_login(FactoryBot.create(:refunder_user))
    get "/races"

    expect(response).to have_http_status(:ok)
    expect(links_to("/register/staff/users").map { |a| a.text.strip }).to eq(["Users"])
    expect(links_to("/register/staff/emails")).to be_empty
  end

  %i[admin_user operator_user].each do |factory|
    it "links Users and Emails for #{factory}" do
      api_login(FactoryBot.create(factory))
      get "/races"

      expect(links_to("/register/staff/users").map { |a| a.text.strip }).to eq(["Users"])
      expect(links_to("/register/staff/emails").map { |a| a.text.strip }).to eq(["Emails"])
    end
  end

  it "shows neither to a racer" do
    api_login(FactoryBot.create(:user))
    get "/races"

    expect(links_to("/register/staff/users")).to be_empty
    expect(links_to("/register/staff/emails")).to be_empty
  end

  %i[admin_user operator_user refunder_user].each do |factory|
    it "no longer links new user creation for #{factory}" do
      api_login(FactoryBot.create(factory))
      get "/races"

      expect(links_to("/users/new")).to be_empty
    end
  end
end

describe "Public sign-up links", type: :request do
  # Owner decision: public sign-up is unchanged; staff no longer create users, racers still sign themselves up.
  it "keeps the logged-out Register link on the new user page" do
    get "/races"

    links = Nokogiri::HTML(response.body).css(%(.navbar a[href="#{new_user_path}"]))
    expect(links.map { |a| a.text.strip }).to eq(["Register"])
  end

  it "keeps the login page's sign up link on the new user page" do
    get new_user_session_path

    expect(response).to have_http_status(:ok)
    links = Nokogiri::HTML(response.body).css(%(a[href="#{new_user_path}"]))
    expect(links.map { |a| a.text.strip }).to include("or Create an account")
  end
end
