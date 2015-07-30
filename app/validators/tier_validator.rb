class TierValidator < ActiveModel::Validator

  def validate(record)
    validate_unique_begin_at(record)
    validate_unique_price(record)
  end

  private

  def validate_unique_begin_at(record)
    tiers = non_self_tiers(record)
    return unless tiers
    dates = tiers.map(&:begin_at)
    if dates.include? record.begin_at
      record.errors[:begin_at] << 'must be unique per payment requirement'
    end
  end

  def validate_unique_price(record)
    tiers = non_self_tiers(record)
    return unless tiers.present?
    prices = tiers.map(&:price)
    if prices.include? record.price
      record.errors[:price] << 'must be unique per payment requirement'
    end
  end

  # helper method
  def non_self_tiers(record)
    if record.requirement.present? && record.requirement.tiers.present?
      tiers = record.requirement.tiers
      tiers.reject { |t| t == record }
    end
  end
end
