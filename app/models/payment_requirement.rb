class PaymentRequirement < Requirement

  has_many :tiers, :foreign_key => :requirement_id

  def fulfilled?
    puts 'stub of fufilled?'
  end

  def active_tier
    return false if tiers.blank?
    return tiers.first if tiers.count == 1

    if tiers.present?
       #todo: implement
    end
  end

  private

  def sorted_tiers
    tiers.sort_by(&:begin_at)
  end
end
