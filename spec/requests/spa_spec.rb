require "spec_helper"

describe "SPA under /register", type: :request do
  let(:build_dir) { Rails.root.join("public", "register") }
  let(:index_file) { build_dir.join("index.html") }

  around do |example|
    backup = index_file.exist? ? File.read(index_file) : nil
    FileUtils.rm_f(index_file)
    example.run
  ensure
    FileUtils.rm_f(index_file)
    File.write(index_file, backup) if backup
  end

  context "when the build exists" do
    before do
      FileUtils.mkdir_p(build_dir)
      File.write(index_file, '<!doctype html><html><body><div id="root"></div></body></html>')
    end

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
