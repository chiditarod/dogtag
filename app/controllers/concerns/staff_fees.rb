# What the staff fee and price endpoints share: which requirements count as fees, the grouped
# payment counts the fee JSON reads, and rendering a fee with its race.
module StaffFees
  extend ActiveSupport::Concern

  private

  # Only the payment types are fees; the type list rather than PaymentRequirement.where, whose
  # subclasses are not all known while classes load lazily.
  def fees
    Requirement.where(type: types)
  end

  def types
    Requirement.allowed_types.map(&:last)
  end

  # { requirement_id => { total:, unrefunded: } } in one grouped query.
  def payment_counts(requirements)
    rows = CompletedRequirement.where(requirement_id: requirements.map(&:id)).group(:requirement_id)
      .pluck(:requirement_id, Arel.sql("COUNT(*)"), Arel.sql("COUNT(*) FILTER (WHERE refunded_at IS NULL)"))
    rows.to_h { |id, total, unrefunded| [id, { total:, unrefunded: }] }
      .tap { |counts| counts.default = { total: 0, unrefunded: 0 } }
  end

  # 422 { error: "invalid", errors: { "field" => [messages] } } for errors built by hand (the model's
  # own go through `render_errors`).
  def render_field_errors(errors)
    render json: { error: "invalid", errors: }, status: :unprocessable_entity
  end

  # Renders { requirement:, race: } for @requirement and @race; `reload: true` rereads its prices
  # first (after one was added or removed).
  def render_fee(status: :ok, reload: false)
    @requirement.tiers.reset if reload
    @payment_counts = payment_counts([@requirement])
    render "api/v1/staff/requirements/show", status:
  end
end
