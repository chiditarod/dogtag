class PaymentRequirement < Requirement

  has_many :tiers

  def fulfilled?
    puts 'stub of fufilled?'
  end

end
