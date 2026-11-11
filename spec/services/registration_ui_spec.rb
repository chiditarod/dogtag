require "spec_helper"

describe RegistrationUi do
  let(:team) { FactoryBot.create(:team) }

  around do |example|
    original = ENV.to_h.slice("REGISTRATION_UI", "APP_HOST")
    example.run
  ensure
    %w[REGISTRATION_UI APP_HOST].each { |key| original.key?(key) ? ENV[key] = original[key] : ENV.delete(key) }
  end

  context "when REGISTRATION_UI is spa" do
    before do
      ENV["REGISTRATION_UI"] = "spa"
      ENV["APP_HOST"] = "register.example.org"
    end

    it "is spa and builds the SPA team url" do
      expect(RegistrationUi.spa?).to eq(true)
      expect(RegistrationUi.team_url(team)).to eq("https://register.example.org/register/teams/#{team.id}")
    end
  end

  context "when REGISTRATION_UI is not spa" do
    before { ENV.delete("REGISTRATION_UI") }

    it "is not spa and builds the legacy team url from mailer default_url_options" do
      allow(UserMailer).to receive(:default_url_options).and_return(host: "legacy.example.org", protocol: "https")
      expect(RegistrationUi.spa?).to eq(false)
      expect(RegistrationUi.team_url(team)).to eq("https://legacy.example.org/teams/#{team.id}")
    end
  end
end
