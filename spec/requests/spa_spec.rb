require "spec_helper"

describe "SPA under /register", type: :request do
  let(:index_file) { Pathname.new(Dir.mktmpdir).join("index.html") }

  before do
    stub_const("ENV", ENV.to_h.except("VITE_DEV_SERVER"))
    allow(SpaController).to receive(:index_path).and_return(index_file)
  end

  after { FileUtils.rm_rf(index_file.dirname) }

  context "when the build exists" do
    before { File.write(index_file, '<!doctype html><html><body><div id="root"></div></body></html>') }

    it "serves index.html for deep links" do
      get "/register/teams/5"
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/html")
      expect(response.body).to include('<div id="root">')
    end

    it "serves index.html at /register" do
      get "/register"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('<div id="root">')
    end

    it "returns 404 for missing assets instead of the SPA shell" do
      get "/register/assets/missing.js"
      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('<div id="root">')
    end

    it "redirects to the Vite dev server when VITE_DEV_SERVER is set" do
      stub_const("ENV", ENV.to_h.merge("VITE_DEV_SERVER" => "http://localhost:5173"))
      get "/register/teams/5"
      expect(response).to redirect_to("http://localhost:5173/register/teams/5")
    end
  end

  context "when the build is missing" do
    it "returns 503 with build instructions" do
      get "/register/teams/5"
      expect(response).to have_http_status(:service_unavailable)
      expect(response.body).to include("npm --prefix frontend run build")
    end
  end
end
