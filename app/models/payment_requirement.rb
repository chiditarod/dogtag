class PaymentRequirement < Requirement

  has_many :tiers, :foreign_key => :requirement_id

  def fulfilled?
    puts 'stub of fufilled?'
  end

  def active_tier
    selected_tier = sorted_tiers.select { |tier| tier.begin_at < Time.now }.last
    selected_tier ||= false
  end

  private

  def sorted_tiers
    tiers.sort_by(&:begin_at)
  end
end
