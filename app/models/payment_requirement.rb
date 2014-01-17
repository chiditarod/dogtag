class PaymentRequirement < Requirement
  has_many :tiers, :foreign_key => :requirement_id, :dependent => :delete_all

  def stripe_params(registration)
    metadata = JSON.generate(
      'race_name' => registration.race.name, 'registration_name' => registration.name,
      'requirement_id' => id, 'registration_id' => registration.id)

    {:description => "#{name} for #{registration.name} | #{registration.race.name}",
     :metadata => metadata,
     :amount => active_tier.price,
     :image => '/images/patch_ring.jpg',
     :name => registration.race.name
    }
  end

  def charge_data(reg)
    metadata = metadata_for reg
    return false if metadata.blank?
    return metadata['charge'] if metadata['charge'].present?
    false

    # todo: after specing replace with this
    #return false unless (metadata.present? && metadata['charge'].present?)
    #return metadata['charge']
  end

  def enabled?
    active_tier.present?
  end

  def active_tier
    selected_tier = chronological_tiers.select { |tier| tier.begin_at < Time.now }.last
    selected_tier ||= false
  end

  private

  def chronological_tiers
    tiers.sort_by(&:begin_at)
  end
end
