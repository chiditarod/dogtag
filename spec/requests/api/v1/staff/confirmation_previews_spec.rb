require "spec_helper"

describe "API v1 staff confirmation preview", type: :request do
  def preview(text)
    post "/api/v1/staff/confirmation_preview", params: { text: }, as: :json
  end

  it "is 401 when logged out" do
    preview("hi")
    expect(response).to have_http_status(:unauthorized)
  end

  %i[user refunder_user].each do |factory|
    it "is 403 for #{factory}" do
      api_login(FactoryBot.create(factory))
      preview("**hi**")
      expect(response).to have_http_status(:forbidden)
      expect(json["html"]).to be_nil
    end
  end

  %i[operator_user admin_user].each do |factory|
    context "as #{factory}" do
      before { api_login(FactoryBot.create(factory)) }

      it "renders Markdown to HTML" do
        preview("**hi**")
        expect(response).to have_http_status(:ok)
        expect(json["html"]).to include("<strong>hi</strong>")
      end

      it "strips unsafe link protocols" do
        preview("[x](javascript:alert(1))")
        expect(response).to have_http_status(:ok)
        expect(json["html"]).not_to include("javascript:")
      end

      it "refuses text over the limit" do
        preview("a" * (Race::CONFIRMATION_TEXT_MAX_LENGTH + 1))
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json["errors"]["text"]).to be_present
      end

      it "answers a blank draft with no HTML" do
        preview("")
        expect(response).to have_http_status(:ok)
        expect(json["html"]).to be_nil
      end

      it "accepts text at the limit" do
        preview("a" * Race::CONFIRMATION_TEXT_MAX_LENGTH)
        expect(response).to have_http_status(:ok)
      end
    end
  end
end
