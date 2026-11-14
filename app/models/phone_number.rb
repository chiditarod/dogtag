# Phone input normalization shared by User and Person.
module PhoneNumber
  # Strips formatting and a leading country code; a 10-digit result becomes
  # "ddd-ddd-dddd". Anything else is returned unchanged so validation can reject it.
  def self.normalize(value)
    return nil if value.nil?

    digits = value.to_s.gsub(/\D/, "")
    digits = digits.delete_prefix("1") if digits.length == 11
    digits.length == 10 ? "#{digits[0, 3]}-#{digits[3, 3]}-#{digits[6, 4]}" : value.to_s
  end
end
