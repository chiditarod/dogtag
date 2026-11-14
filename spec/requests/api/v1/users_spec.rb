require "spec_helper"

describe "API v1 users", type: :request do
  let(:valid_params) do
    { user: { first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", phone: "555-123-4567",
              password: "12345678", password_confirmation: "12345678" } }
  end

  before { Workers::WelcomeEmail.jobs.clear }

  describe "POST /api/v1/users" do
    it "creates the user, logs them in and enqueues the welcome email" do
      expect { post "/api/v1/users", params: valid_params, as: :json }.to change(User, :count).by(1)
      expect(response).to have_http_status(:created)
      user = User.find_by!(email: "ada@example.com")
      expect(json["user"]).to include("id" => user.id, "email" => "ada@example.com", "first_name" => "Ada")
      expect(Workers::WelcomeEmail.jobs.size).to eq(1)
      expect(session_user_id).to eq(user.id)
    end

    it "returns field errors when invalid" do
      valid_params[:user][:email] = ""
      expect { post "/api/v1/users", params: valid_params, as: :json }.not_to change(User, :count)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq("invalid")
      expect(json["errors"]["email"]).to be_present
      expect(Workers::WelcomeEmail.jobs.size).to eq(0)
    end

    it "returns 400 without a user param" do
      post "/api/v1/users", params: {}, as: :json
      expect(response).to have_http_status(:bad_request)
      expect(json["error"]).to be_present
    end

    it "ignores roles" do
      valid_params[:user][:roles] = ["admin"]
      valid_params[:user][:roles_mask] = 1
      post "/api/v1/users", params: valid_params, as: :json
      expect(response).to have_http_status(:created)
      expect(User.find_by!(email: "ada@example.com").is?(:admin)).to be(false)
    end
  end
end
