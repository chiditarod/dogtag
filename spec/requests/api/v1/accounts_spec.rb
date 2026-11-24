require "spec_helper"

describe "API v1 accounts", type: :request do
  let(:user) { FactoryBot.create(:user, first_name: "Ada", last_name: "Lovelace") }

  describe "PATCH /api/v1/me" do
    context "when logged in" do
      before { api_login(user) }

      it "updates name, email and phone with the current password" do
        patch "/api/v1/me",
              params: { current_password: "12345678",
                        user: { first_name: "Grace", last_name: "Hopper", email: "NEW@Example.com", phone: "555-987-6543" } },
              as: :json
        expect(response).to have_http_status(:ok)
        expect(json["user"]).to include("id" => user.id, "email" => "new@example.com", "first_name" => "Grace")
        user.reload
        expect(user.first_name).to eq("Grace")
        expect(user.email).to eq("new@example.com")
      end

      it "refuses any change without the current password" do
        patch "/api/v1/me", params: { user: { first_name: "Grace" } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["error"]).to eq("invalid")
        expect(json["errors"]["current_password"]).to eq(["is not correct"])
        expect(user.reload.first_name).to eq("Ada")
      end

      it "refuses a wrong current password and keeps the old password" do
        patch "/api/v1/me",
              params: { current_password: "wrong-one",
                        user: { password: "brandnew123", password_confirmation: "brandnew123" } },
              as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["current_password"]).to eq(["is not correct"])
        expect(user.reload.valid_password?("12345678")).to be(true)
      end

      it "changes the password and stays logged in" do
        patch "/api/v1/me",
              params: { current_password: "12345678",
                        user: { password: "brandnew123", password_confirmation: "brandnew123" } },
              as: :json
        expect(response).to have_http_status(:ok)
        expect(user.reload.valid_password?("brandnew123")).to be(true)
        expect(session_user_id).to eq(user.id)
      end

      it "reports a taken email without saving" do
        FactoryBot.create(:user, email: "taken@example.com")
        patch "/api/v1/me", params: { current_password: "12345678", user: { email: "taken@example.com" } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["email"]).to be_present
        expect(user.reload.email).not_to eq("taken@example.com")
      end

      it "ignores roles" do
        patch "/api/v1/me",
              params: { current_password: "12345678", user: { first_name: "Grace", roles: ["admin"], roles_mask: 1 } },
              as: :json
        expect(response).to have_http_status(:ok)
        expect(user.reload.is?(:admin)).to be(false)
      end
    end

    it "requires login" do
      patch "/api/v1/me", params: { current_password: "12345678", user: { first_name: "Grace" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(json["error"]).to eq("not_authenticated")
    end
  end
end
