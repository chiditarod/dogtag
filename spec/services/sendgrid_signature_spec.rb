require "spec_helper"

describe SendgridSignature do
  let(:key) { OpenSSL::PKey::EC.generate("prime256v1") }
  let(:public_key) { Base64.strict_encode64(key.public_to_der) }
  let(:payload) { '[{"event":"delivered","sent_email_id":1}]' }
  let(:timestamp) { "1700000000" }
  let(:signature) { Base64.strict_encode64(key.sign(OpenSSL::Digest::SHA256.new, timestamp + payload)) }

  def valid?(**overrides)
    SendgridSignature.valid?(**{ payload: payload, signature: signature, timestamp: timestamp, public_key: public_key }.merge(overrides))
  end

  it "accepts a correctly signed payload" do
    expect(valid?).to be true
  end

  it "rejects a tampered payload" do
    expect(valid?(payload: payload.sub("delivered", "bounce"))).to be false
  end

  it "rejects a different timestamp" do
    expect(valid?(timestamp: "1700000001")).to be false
  end

  it "rejects a signature from a different key" do
    other = Base64.strict_encode64(OpenSSL::PKey::EC.generate("prime256v1").public_to_der)
    expect(valid?(public_key: other)).to be false
  end

  it "returns false instead of raising for malformed input" do
    expect(valid?(public_key: "not a key")).to be false
    expect(valid?(signature: "%%%")).to be false
    expect(valid?(signature: nil)).to be false
    expect(valid?(public_key: nil)).to be false
    expect(valid?(timestamp: nil)).to be false
  end
end
