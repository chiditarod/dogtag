require "spec_helper"

describe SpaUrl do
  before do
    allow(UserMailer).to receive(:default_url_options).and_return(host: "register.example.org", protocol: "https")
  end

  it "builds a SPA url from the mailer host and protocol" do
    expect(SpaUrl.for("/teams/5")).to eq("https://register.example.org/register/teams/5")
    expect(SpaUrl.for).to eq("https://register.example.org/register/")
  end

  it "keeps a port in the host and defaults the protocol to http" do
    allow(UserMailer).to receive(:default_url_options).and_return(host: "localhost:3000")
    expect(SpaUrl.for("/teams/5")).to eq("http://localhost:3000/register/teams/5")
  end

  it "uses the given host, keeping the protocol" do
    expect(SpaUrl.for("/reset-password/abc123", host: "mail.example.org"))
      .to eq("https://mail.example.org/register/reset-password/abc123")
  end
end
