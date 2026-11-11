require "spec_helper"

describe "API v1 error envelope", type: :request do
  let(:not_found) { { "error" => "not_found", "errors" => {} } }

  it "returns a 404 envelope for unknown paths" do
    get "/api/v1/nope"
    expect(response).to have_http_status(:not_found)
    expect(json).to eq(not_found)
  end

  it "returns a 404 envelope for a wrong verb" do
    get "/api/v1/session"
    expect(response).to have_http_status(:not_found)
    expect(json).to eq(not_found)
  end

  it "returns a 400 envelope for malformed JSON" do
    post "/api/v1/session", params: "{not json", headers: { "CONTENT_TYPE" => "application/json" }
    expect(response).to have_http_status(:bad_request)
    expect(json).to eq("error" => "bad_request", "errors" => {})
  end

  it "returns a 500 envelope for unexpected exceptions" do
    allow(User).to receive(:find_by).and_raise(RuntimeError, "boom")
    allow_any_instance_of(Api::V1::BaseController).to receive(:rescue_unexpected_errors?).and_return(true)
    post "/api/v1/password_resets", params: { email: "a@b.com" }, as: :json
    expect(response).to have_http_status(:internal_server_error)
    expect(json).to eq("error" => "server_error", "errors" => {})
  end
end
