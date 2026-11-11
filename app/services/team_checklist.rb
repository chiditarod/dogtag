# Builds the registration checklist for a team: racers, team questions,
# registration fee and finalization status.
class TeamChecklist
  def initialize(team)
    @team = team
    @race = team.race
  end

  def to_h
    racers = racers_item
    questions = questions_item
    fee = fee_item

    {
      racers: racers,
      questions: questions,
      fee: fee,
      finalized: !!team.finalized,
      remaining: remaining(racers, questions, fee),
      team_number: team.assigned_team_number,
      classy_fundraising_url: classy_fundraising_url,
      # Only races with a Classy campaign get a fundraising page, so only they should wait for one.
      classy_expected: race.classy_campaign_id.present?
    }
  end

  private

  attr_reader :team, :race

  def racers_item
    filled = team.people.size
    total = race.people_per_team
    { filled: filled, total: total, done: filled >= total }
  end

  def questions_item
    { required: race.jsonform.present?, done: team.completed_questions? }
  end

  def fee_item
    requirements = payment_requirements
    if requirements.empty?
      return { done: true, amount_due_cents: nil, paid_cents: 0, next_tier: nil, requirement_id: nil, items: [] }
    end

    unpaid = requirements.reject { |requirement| completed.key?(requirement.id) }
    payable = unpaid.select(&:enabled?)

    {
      done: team.completed_all_requirements?,
      amount_due_cents: (payable.sum(&:amount_due_cents) if payable.any?),
      paid_cents: team.money_paid_in_cents,
      next_tier: tier_hash(unpaid.flat_map(&:next_tiers).min_by(&:begin_at)),
      requirement_id: payable.first&.id,
      items: requirements.select { |requirement| listed?(requirement) }.map { |requirement| fee_line(requirement) }
    }
  end

  # One payable line of the fee; a completed line has nothing due and no upcoming price.
  def fee_line(requirement)
    completed_requirement = completed[requirement.id]
    done = completed_requirement.present?

    {
      requirement_id: requirement.id,
      name: requirement.name,
      done: done,
      amount_due_cents: done ? nil : requirement.amount_due_cents,
      paid_cents: completed_requirement&.metadata&.fetch("amount", nil).to_i,
      next_tier: done ? nil : tier_hash(requirement.next_tiers.first)
    }
  end

  # Listed once it has a price now or a price coming.
  def listed?(requirement)
    requirement.enabled? || requirement.next_tiers.any?
  end

  # Payment requirements (including MockPaymentRequirement), ordered by id.
  def payment_requirements
    race.requirements.select { |requirement| requirement.is_a?(PaymentRequirement) }.sort_by(&:id)
  end

  def completed
    @completed ||= team.completed_requirements.index_by(&:requirement_id)
  end

  def tier_hash(tier)
    { price_cents: tier.price, begins_at: tier.begin_at } if tier
  end

  def remaining(racers, questions, fee)
    [racers[:done], !questions[:required] || questions[:done], fee[:done]].count(false)
  end

  def classy_fundraising_url
    return if team.classy_id.blank?

    "https://www.classy.org/team/#{team.classy_id}?campaignId=#{race.classy_campaign_id}"
  end
end
