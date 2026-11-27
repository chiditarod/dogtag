require "spec_helper"

# Every legacy page that survives the racer cleanup. Racer pages are served by the SPA, so
# nothing here may link to a URL that redirects (or later 404s). Later tasks delete racer routes
# and rerun this spec.
describe "Kept legacy pages", type: :request do
  RACER_URL = %r{\A/(teams|account|login|user_session/new|password_resets|races/?\z|races/\d+/?\z|races/\d+/registrations|users/new|users/\d+/edit)}
  USER_SHOW_URL = %r{\A/users/\d+/?\z}

  # Racer URLs a page links to with GET: plain links and GET forms, not DELETE/PATCH buttons.
  def racer_hrefs(body)
    doc = Nokogiri::HTML(body)
    links = doc.css("a[href]").reject { |a| a["data-method"].present? && a["data-method"] != "get" }.pluck("href")
    forms = doc.css("form[action]").select { |f| f["method"].to_s.casecmp?("get") }.pluck("action")
    (links + forms).select do |url|
      path = URI(url).path.to_s
      path.match?(RACER_URL) || path.match?(USER_SHOW_URL)
    rescue URI::InvalidURIError
      false
    end
  end

  def navbar_hrefs(body)
    Nokogiri::HTML(body).css(".navbar a[href]").pluck("href")
  end

  def expect_clean_page(status)
    path = request.fullpath
    expect(response).to have_http_status(status), "#{path} answered #{response.status}"
    expect(response.body).not_to include("translation_missing"), "#{path} is missing #{response.body.scan(/translation missing: [\w.]+/).uniq.join(", ")}"
    expect(racer_hrefs(response.body)).to eq([]), "#{path} links to a racer URL"
  end

  let(:race) { FactoryBot.create(:race) }
  let(:requirement) { FactoryBot.create(:payment_requirement, race: race) }
  let!(:tier) { FactoryBot.create(:tier, requirement: requirement) }
  # No tier yet, so the race page shows its "action required" link.
  let!(:disabled_requirement) { FactoryBot.create(:payment_requirement, race: race) }

  let(:staff_pages) do
    {
      "/users" => :admin_user,
      "/sent_emails" => :operator_user,
      "/races/new" => :operator_user,
      "/races/#{race.id}/edit" => :operator_user,
      "/races/#{race.id}/requirements/#{requirement.id}/edit" => :operator_user,
      "/races/#{race.id}/requirements/new" => :operator_user,
      "/tiers/new?requirement_id=#{requirement.id}" => :operator_user,
      "/tiers/#{tier.id}/edit" => :operator_user
    }
  end

  before do
    owner = FactoryBot.create(:user)
    team = FactoryBot.create(:team, user: owner, race: race)
    CompletedRequirement.create!(team: team, requirement: requirement, user: owner, metadata: { "charge_id" => "ch_1", "customer_id" => "cus_1", "amount" => 5000 })
    FactoryBot.create(:sent_email, team_id: team.id)
  end

  it "renders each staff page for its staff role without racer links" do
    staff_pages.each do |path, factory|
      api_login(FactoryBot.create(factory))
      get path
      expect_clean_page(:ok)
    end
  end

  it "renders each staff page for an admin" do
    api_login(FactoryBot.create(:admin_user))
    staff_pages.each_key do |path|
      get path
      expect_clean_page(:ok)
    end
  end

  it "sends a logged-out visitor to the SPA login" do
    staff_pages.each_key do |path|
      get path
      expect(response).to redirect_to("/register/login")
    end
  end

  it "never serves a staff page to a racer" do
    api_login(FactoryBot.create(:user))
    staff_pages.each_key do |path|
      # The test environment raises instead of rendering the access-denied redirect.
      expect { get path }.to raise_error(CanCan::AccessDenied)
    end
  end

  describe "the error page (carries the navbar)" do
    it "links the logged-out navbar to the SPA login" do
      get "/no-such-page"

      expect_clean_page(:not_found)
      expect(navbar_hrefs(response.body)).to include("/register", "/register/login", "/register/signup", "/register/forgot-password")
    end

    it "links a racer's navbar to the SPA account page" do
      api_login(FactoryBot.create(:user))
      get "/no-such-page"

      expect_clean_page(:not_found)
      expect(navbar_hrefs(response.body)).to include("/register/account")
    end

    it "links the navbar of a racer who owns a team (My teams) to the SPA" do
      owner = FactoryBot.create(:user)
      FactoryBot.create(:team, user: owner, race: race)
      api_login(owner)
      get "/no-such-page"

      expect_clean_page(:not_found)
      expect(navbar_hrefs(response.body)).to include("/register/teams", "/register/account")
    end

    it "links an admin's navbar to the SPA account page" do
      api_login(FactoryBot.create(:admin_user))
      get "/no-such-page"

      expect_clean_page(:not_found)
      expect(navbar_hrefs(response.body)).to include("/register/account")
    end
  end

  it "links the users table to the SPA staff user, team and race pages" do
    api_login(FactoryBot.create(:admin_user))
    get "/users"

    hrefs = Nokogiri::HTML(response.body).css("#users a[href]").pluck("href")
    expect(hrefs).to include(%r{\A/register/staff/users/\d+\z}, %r{\A/register/teams/\d+\z}, %r{\A/register/staff/races/\d+\z})
    expect(hrefs).not_to include("/users/new")
  end
end
