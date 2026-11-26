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
