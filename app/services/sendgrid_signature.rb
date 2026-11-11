# Verifies SendGrid Signed Event Webhook requests: an ECDSA P-256 SHA256
# signature over (timestamp + raw request body). The public key is the base64
# DER string shown in the SendGrid webhook settings.
module SendgridSignature
  def self.valid?(payload:, signature:, timestamp:, public_key:)
    return false if [payload, signature, timestamp, public_key].any?(&:blank?)

    key = OpenSSL::PKey::EC.new(Base64.decode64(public_key))
    key.verify(OpenSSL::Digest::SHA256.new, Base64.decode64(signature), timestamp + payload)
  rescue OpenSSL::PKey::PKeyError, ArgumentError
    false
  end
end
