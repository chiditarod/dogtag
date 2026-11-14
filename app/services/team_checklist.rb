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
      classy_fundraising_url: classy_fundraising_url
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
    requirement = payment_requirement
    return { done: true, amount_due_cents: nil, paid_cents: 0, next_tier: nil, requirement_id: nil } unless requirement

    {
      done: team.completed_all_requirements?,
      amount_due_cents: requirement.amount_due_cents,
      paid_cents: team.money_paid_in_cents,
      next_tier: next_tier(requirement),
      requirement_id: requirement.id
    }
  end

  # First enabled payment requirement (including MockPaymentRequirement),
  # falling back to the first one so a not-yet-open fee still has an id and next tier.
  def payment_requirement
    payment_requirements = race.requirements.select { |requirement| requirement.is_a?(PaymentRequirement) }
    payment_requirements.find(&:enabled?) || payment_requirements.first
  end

  def next_tier(requirement)
    tier = requirement.next_tiers.first
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
