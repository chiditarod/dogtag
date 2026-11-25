require "spec_helper"

describe AdminConstraint do
  let(:request) { ActionDispatch::Request.new(Rack::MockRequest.env_for("/sidekiq")) }

  around do |example|
    original = Authlogic::Session::Base.controller
    example.run
    Authlogic::Session::Base.controller = original
  end

  it "restores Authlogic's controller after checking" do
    Authlogic::Session::Base.controller = :sentinel
    expect(described_class.new.matches?(request)).to be(false)
    expect(Authlogic::Session::Base.controller).to eq(:sentinel)
  end

  it "leaves Authlogic's controller nil when it was nil" do
    Authlogic::Session::Base.controller = nil
    described_class.new.matches?(request)
    expect(Authlogic::Session::Base.controller).to be_nil
  end

  it "restores the controller and refuses when the check raises" do
    Authlogic::Session::Base.controller = :sentinel
    allow(UserSession).to receive(:find).and_raise("boom")
    expect(described_class.new.matches?(request)).to be(false)
    expect(Authlogic::Session::Base.controller).to eq(:sentinel)
  end
end
