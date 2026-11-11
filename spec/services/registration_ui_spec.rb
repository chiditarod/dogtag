require "spec_helper"

describe RegistrationUi do
  let(:team) { FactoryBot.create(:team) }
  let(:built) { true }

  around do |example|
    original = ENV.to_h.slice("REGISTRATION_UI", "VITE_DEV_SERVER")
    example.run
  ensure
    %w[REGISTRATION_UI VITE_DEV_SERVER].each { |key| original.key?(key) ? ENV[key] = original[key] : ENV.delete(key) }
  end

  before do
    ENV.delete("VITE_DEV_SERVER")
    allow(File).to receive(:exist?).and_call_original
    allow(File).to receive(:exist?).with(SpaController.index_path).and_return(built)
    allow(UserMailer).to receive(:default_url_options).and_return(host: "register.example.org", protocol: "https")
  end

  context "when REGISTRATION_UI is spa and the SPA is built" do
    before { ENV["REGISTRATION_UI"] = "spa" }

    it "is spa and builds the SPA team url from mailer default_url_options" do
      expect(RegistrationUi.spa?).to eq(true)
      expect(RegistrationUi.team_url(team)).to eq("https://register.example.org/register/teams/#{team.id}")
    end

    it "keeps a port in the host and defaults the protocol to http" do
      allow(UserMailer).to receive(:default_url_options).and_return(host: "localhost:3000")
      expect(RegistrationUi.team_url(team)).to eq("http://localhost:3000/register/teams/#{team.id}")
    end
  end

  context "when REGISTRATION_UI is spa but the SPA is not built" do
    let(:built) { false }

    before { ENV["REGISTRATION_UI"] = "spa" }

    it "falls back to the legacy UI" do
      expect(RegistrationUi.spa?).to eq(false)
      expect(RegistrationUi.team_url(team)).to eq("https://register.example.org/teams/#{team.id}")
    end

    it "is spa when a Vite dev server serves it" do
      ENV["VITE_DEV_SERVER"] = "http://localhost:5173"
      expect(RegistrationUi.spa?).to eq(true)
    end
  end

  context "when REGISTRATION_UI is not spa" do
    before { ENV.delete("REGISTRATION_UI") }

    it "is not spa and builds the legacy team url from mailer default_url_options" do
      expect(RegistrationUi.spa?).to eq(false)
      expect(RegistrationUi.team_url(team)).to eq("https://register.example.org/teams/#{team.id}")
    end
  end
end
