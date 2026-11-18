require "spec_helper"

describe "API v1 feedback", type: :request do
  let(:deliveries) { ActionMailer::Base.deliveries }
  let(:team) { FactoryBot.create(:team) }

  before { deliveries.clear }

  it "emails staff the message with the racer and page context" do
    api_login(team.user)
    post "/api/v1/feedback",
         params: { message: "The fee button is stuck", context: { path: "/register/teams/#{team.id}", team_id: team.id, user_agent: "TestBrowser/1" } },
         as: :json

    expect(response).to have_http_status(:created)
    mail = deliveries.last
    expect(mail.to).to eq(["registration@chiditarod.org"])
    expect(mail.reply_to).to eq([team.user.email])
    expect(mail.body.to_s).to include("The fee button is stuck", team.user.email, team.name, "/register/teams/#{team.id}", "TestBrowser/1")
  end

  it "accepts feedback from someone who is logged out" do
    post "/api/v1/feedback", params: { message: "Cannot log in" }, as: :json

    expect(response).to have_http_status(:created)
    expect(deliveries.last.reply_to).to be_blank
    expect(deliveries.last.body.to_s).to include("not logged in")
  end

  it "rejects a blank or missing message and sends nothing" do
    post "/api/v1/feedback", params: { message: "   " }, as: :json
    expect(response).to have_http_status(:bad_request)

    post "/api/v1/feedback", params: {}, as: :json
    expect(response).to have_http_status(:bad_request)
    expect(deliveries).to be_empty
  end
end
