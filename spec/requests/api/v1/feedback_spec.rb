require "spec_helper"

describe "API v1 feedback", type: :request do
  let(:deliveries) { ActionMailer::Base.deliveries }
  let(:team) { FactoryBot.create(:team) }
  let(:context) { { path: "/register/teams/#{team.id}", team_id: team.id, user_agent: "TestBrowser/1" } }

  before { deliveries.clear }

  def send_feedback(message: "The fee button is stuck", context: self.context)
    post "/api/v1/feedback", params: { message: message, context: context }, as: :json
  end

  it "emails staff the message with the racer and page context" do
    api_login(team.user)
    send_feedback

    expect(response).to have_http_status(:created)
    mail = deliveries.last
    expect(mail.to).to eq(["registration@chiditarod.org"])
    expect(mail.reply_to).to eq([team.user.email])
    expect(mail.body.to_s).to include("The fee button is stuck", team.user.email, team.name, "/register/teams/#{team.id}", "TestBrowser/1")
  end

  it "records the email in the sent_emails log against the sender and team" do
    api_login(team.user)

    expect { send_feedback }.to change { SentEmail.where(kind: "feedback").count }.by(1)
    expect(SentEmail.last).to have_attributes(user_id: team.user.id, team_id: team.id, race_id: team.race_id)
  end

  it "accepts feedback from someone who is logged out" do
    post "/api/v1/feedback", params: { message: "Cannot log in" }, as: :json

    expect(response).to have_http_status(:created)
    expect(deliveries.last.reply_to).to be_blank
    expect(deliveries.last.body.to_s).to include("not logged in")
  end

  it "rejects a blank message and sends nothing" do
    post "/api/v1/feedback", params: { message: "   " }, as: :json

    expect(response).to have_http_status(:bad_request)
    expect(deliveries).to be_empty
  end

  it "rejects a missing message and sends nothing" do
    post "/api/v1/feedback", params: {}, as: :json

    expect(response).to have_http_status(:bad_request)
    expect(json).to include("error" => a_kind_of(String), "errors" => {})
    expect(deliveries).to be_empty
  end

  it "truncates the message to 5000 characters and each context value to 500" do
    send_feedback(message: "m" * 6000, context: { path: "p" * 600, user_agent: "u" * 600 })

    expect(response).to have_http_status(:created)
    body = deliveries.last.body.to_s
    expect(body).to include("m" * 5000)
    expect(body).not_to include("m" * 5001)
    expect(body).to include("p" * 500)
    expect(body).not_to include("p" * 501)
    expect(body).not_to include("u" * 501)
  end

  describe "malformed context" do
    [["a string", "oops"], ["an array", ["a", "b"]], ["an array of hashes", [{ path: "/x" }]]].each do |label, value|
      it "ignores #{label} and still sends the message" do
        send_feedback(context: value)

        expect(response).to have_http_status(:created)
        expect(deliveries.last.body.to_s).to include("The fee button is stuck")
      end
    end
  end

  describe "the team named in the context" do
    it "is shown and tracked for the team's owner" do
      api_login(team.user)
      send_feedback

      expect(deliveries.last.body.to_s).to include("#{team.name} (#{team.id}), #{team.race.name}")
      expect(SentEmail.last.team_id).to eq(team.id)
    end

    it "is shown and tracked for staff who may view teams" do
      staff = FactoryBot.create(:operator_user)
      api_login(staff)
      send_feedback

      expect(deliveries.last.body.to_s).to include(team.name)
      expect(SentEmail.last).to have_attributes(user_id: staff.id, team_id: team.id)
    end

    it "is only an unverified claim, and not tracked, for another racer" do
      api_login(FactoryBot.create(:user2))
      send_feedback

      expect(response).to have_http_status(:created)
      expect(deliveries.last.body.to_s).to include("claimed team id #{team.id} (unverified)")
      expect(deliveries.last.body.to_s).not_to include(team.name)
      expect(SentEmail.last.team_id).to be_nil
    end

    it "is only an unverified claim when nobody is logged in" do
      send_feedback

      expect(deliveries.last.body.to_s).to include("claimed team id #{team.id} (unverified)")
      expect(deliveries.last.body.to_s).not_to include(team.name)
      expect(SentEmail.last.team_id).to be_nil
    end

    it "is an unverified claim when the id matches no team" do
      api_login(team.user)
      send_feedback(context: context.merge(team_id: 0))

      expect(response).to have_http_status(:created)
      expect(deliveries.last.body.to_s).to include("claimed team id 0 (unverified)")
      expect(SentEmail.last.team_id).to be_nil
    end
  end

  describe "rate limiting" do
    # Specs run with a null cache, which never counts. Back the controller's captured
    # store with a real one for this example.
    let(:store) { ActiveSupport::Cache::MemoryStore.new }

    before do
      allow(Api::V1::FeedbackController.cache_store).to receive(:increment) do |*args, **options|
        store.increment(*args, **options)
      end
    end

    it "answers the sixth request in a minute with 429 and the error shape, and sends nothing for it" do
      5.times do
        send_feedback
        expect(response).to have_http_status(:created)
      end
      deliveries.clear

      send_feedback

      expect(response).to have_http_status(:too_many_requests)
      expect(json).to eq("error" => "rate_limited", "errors" => {})
      expect(deliveries).to be_empty
    end
  end
end
