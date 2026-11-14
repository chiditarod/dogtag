module ApiHelpers
  def json
    JSON.parse(response.body)
  end

  # Id of the user the Authlogic session cookie authenticates, or nil (probes GET /api/v1/me).
  def session_user_id
    get "/api/v1/me"
    response.successful? ? json.dig("user", "id") : nil
  end

  def api_login(user, password: "12345678", remember_me: false)
    post "/api/v1/session", params: { email: user.email, password: password, remember_me: remember_me }, as: :json
    expect(response).to have_http_status(:ok)
  end
end

RSpec.configure do |config|
  config.include ApiHelpers, type: :request
end
