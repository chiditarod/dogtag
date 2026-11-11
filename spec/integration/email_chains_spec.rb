require "spec_helper"

# Layer 1 of email verification: exercise each chain end to end with Sidekiq
# inline and assert on ActionMailer deliveries and the SentEmail log.
describe UsersController, type: :controller do
  it "signup sends welcome" do
    Sidekiq::Testing.inline! do
      post :create, params: { user: FactoryBot.attributes_for(:user) }
    end

    user = User.last
    expect(ActionMailer::Base.deliveries.size).to eq(1)
    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([user.email])
    expect(mail.subject).to eq("Welcome to dogTag")
    expect(SentEmail.where(kind: "welcome", user_id: user.id).count).to eq(1)
  end
end

describe "email chains" do
  include Rails.application.routes.url_helpers

  it "password reset email contains a working edit link" do
    user = FactoryBot.create(:user)

    Sidekiq::Testing.inline! { user.reset_password!("example.org") }

    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([user.email])
    expect(mail.subject).to eq("dogTag Password Reset Instructions")
    expect(mail.body.encoded).to include(edit_password_reset_url(user.reload.perishable_token, host: "example.org"))
    expect(SentEmail.where(kind: "password_reset", user_id: user.id).count).to eq(1)
  end

  context "finalizing a team on a race with classy data" do
    let(:classy_url) { "#{ClassyClient::API_HOST}/#{ClassyClient::API_VERSION}" }
    let(:race) { FactoryBot.create(:race, :with_classy_data) }
    let(:requirement) { FactoryBot.create(:enabled_payment_requirement, race: race) }
    let(:user) { FactoryBot.create(:user) }
    let!(:team) { FactoryBot.create(:team, :with_enough_people, race: race, user: user) }

    around do |example|
      saved = ENV.values_at("CLASSY_CLIENT_ID", "CLASSY_CLIENT_SECRET")
      ENV["CLASSY_CLIENT_ID"] = "some_id"
      ENV["CLASSY_CLIENT_SECRET"] = "some_secret"
      example.run
    ensure
      ENV["CLASSY_CLIENT_ID"], ENV["CLASSY_CLIENT_SECRET"] = saved
    end

    before do
      auth = { "access_token" => "abc123", "token_type" => "bearer", "expires_in" => 3600 }
      stub_request(:post, ClassyClient::AUTH_ENDPOINT).to_return(status: 200, body: auth.to_json)
      stub_request(:get, "#{classy_url}/campaigns/12345")
        .to_return(status: 200, body: File.read(Rails.root.join("spec/fixtures/classy/get_campaign_response.json")))
      stub_request(:post, %r{#{classy_url}/organizations/\d+/members})
        .to_return(status: 200, body: { "id" => 111 }.to_json)
      stub_request(:post, "#{classy_url}/campaigns/12345/fundraising-teams")
        .to_return(status: 200, body: File.read(Rails.root.join("spec/fixtures/classy/create_campaign_team_response.json")))
    end

    it "finalizing a team sends team_finalized and classy_fundraising" do
      Sidekiq::Testing.inline! { requirement.complete(team.id, user) }

      expect(team.reload).to be_finalized
      expect(team.classy_id).to be_present
      subjects = ActionMailer::Base.deliveries.map(&:subject)
      expect(subjects).to include(a_string_including("Registration Confirmed for"))
      expect(subjects).to include(a_string_including("Fundraising is ready for"))
      expect(SentEmail.where(team_id: team.id).pluck(:kind)).to contain_exactly("team_finalized", "classy_fundraising")
    end
  end
end
