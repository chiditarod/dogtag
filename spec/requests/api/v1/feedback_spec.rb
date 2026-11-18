require "spec_helper"

describe "API v1 feedback", type: :request do
  let(:deliveries) { ActionMailer::Base.deliveries }
  let(:team) { FactoryBot.create(:team) }
  let(:context) { { path: "/register/teams/#{team.id}", team_id: team.id, user_agent: "TestBrowser/1" } }

  before do
    deliveries.clear
    api_login(team.user)
  end

  def send_feedback(message: "The fee button is stuck", context: self.context)
    post "/api/v1/feedback", params: { message: message, context: context }, as: :json
  end

  it "emails staff the message with the racer and page context" do
    send_feedback

    expect(response).to have_http_status(:created)
    mail = deliveries.last
    expect(mail.to).to eq(["registration@chiditarod.org"])
    expect(mail.reply_to).to eq([team.user.email])
    expect(mail.body.to_s).to include("The fee button is stuck", team.user.email, team.name, "/register/teams/#{team.id}", "TestBrowser/1")
  end

  it "records the email in the sent_emails log against the sender and team" do

    expect { send_feedback }.to change { SentEmail.where(kind: "feedback").count }.by(1)
    expect(SentEmail.last).to have_attributes(user_id: team.user.id, team_id: team.id, race_id: team.race_id)
  end

  it "refuses someone who is logged out with 401 and sends nothing" do
    reset!
    post "/api/v1/feedback", params: { message: "Cannot log in" }, as: :json

    expect(response).to have_http_status(:unauthorized)
    expect(json).to include("error" => "not_authenticated", "errors" => {})
    expect(deliveries).to be_empty
    expect(SentEmail.where(kind: "feedback")).to be_empty
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

    it "is an unverified claim when the id matches no team" do
        send_feedback(context: context.merge(team_id: 0))

      expect(response).to have_http_status(:created)
      expect(deliveries.last.body.to_s).to include("claimed team id 0 (unverified)")
      expect(SentEmail.last.team_id).to be_nil
    end
  end

  describe "the per-account cap" do
    def send_times(count)
      count.times do
        send_feedback
        expect(response).to have_http_status(:created)
      end
    end

    it "answers the sixth send within an hour with 429 and the error shape, and sends nothing for it" do
      send_times(5)
      deliveries.clear

      send_feedback

      expect(response).to have_http_status(:too_many_requests)
      expect(json).to eq("error" => "rate_limited", "errors" => {})
      expect(deliveries).to be_empty
    end

    it "counts each account on its own" do
      send_times(5)

      api_login(FactoryBot.create(:user2))
      send_feedback

      expect(response).to have_http_status(:created)
    end

    it "does not count deliveries that failed" do
      5.times { SentEmail.create!(kind: "feedback", user_id: team.user.id, status: "failed") }

      send_feedback

      expect(response).to have_http_status(:created)
    end

    it "allows another send once the hour has passed" do
      send_times(5)

      Timecop.travel(61.minutes.from_now) do
        send_feedback

        expect(response).to have_http_status(:created)
      end
    end
  end
end
