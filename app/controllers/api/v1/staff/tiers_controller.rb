# Prices (tiers) of a fee for staff. Operators add and change prices; only admins delete them.
# Every action answers with the whole fee and its race, as RequirementsController#show does.
class Api::V1::Staff::TiersController < Api::V1::Staff::BaseController
  include RaceTimeZone
  include StaffFeeParams
  include StaffFees

  # Staff-level access first, so a refunder never gets a 400 or 404 that describes the data.
  before_action -> { authorize!(:create, Tier) }, only: [:create]
  before_action -> { authorize!(:update, Tier) }, only: [:update]
  before_action -> { authorize!(:destroy, Tier) }, only: [:destroy]
  before_action :load_requirement, only: [:create]
  before_action :load_tier, only: [:update, :destroy]
  # The start time is a wall clock in the race's own zone.
  around_action :use_race_time_zone, only: [:create, :update]

  def create
    attrs = params.expect(tier: [:price, :begin_at])
    @tier = Tier.new(requirement: @requirement)
    authorize!(:create, @tier)

    save_tier(attrs, status: :created)
  end

  def update
    authorize!(:update, @tier)
    # Only the keys sent change; a start left out keeps its seconds.
    save_tier(params.expect(tier: [:price, :begin_at]), status: :ok, only_sent: true)
  end

  def destroy
    authorize!(:destroy, @tier)
    return render_fee(reload: true) if @tier.destroy

    render_errors(@tier.errors.full_messages.to_sentence, code: "only_price_of_paid_fee")
  end

  private

  def load_requirement
    @requirement = fees.includes(:tiers).find(params[:requirement_id])
    @race = @requirement.race
  end

  def load_tier
    @tier = Tier.find(params[:id])
    @requirement = fees.includes(:tiers).find(@tier.requirement_id)
    @tier.requirement = @requirement
    @race = @requirement.race
  end

  # Used by the around_action: the zone of the race the fee belongs to.
  def race_time_zone
    @race&.time_zone
  end

  # Assigns what was sent (`only_sent`: just the keys present; otherwise both), checks it, saves.
  def save_tier(attrs, status:, only_sent: false)
    errors = assign_tier_attrs(attrs, only_sent)
    @tier.valid?
    errors = @tier.errors.to_hash.transform_keys(&:to_s).merge(errors)
    return render_field_errors(errors) if errors.any?

    @tier.save!
    render_fee(status:, reload: true)
  end

  # Returns the errors for fields that could not be read; the rest are left to the model. A price
  # that fails the whole-dollar rule is not assigned (its model messages are replaced too).
  def assign_tier_attrs(attrs, only_sent)
    errors = {}
    if !only_sent || attrs.key?(:price)
      price_error = whole_dollar_error(attrs[:price])
      price_error ? errors["price"] = [price_error] : @tier.price = attrs[:price]
    end
    if !only_sent || attrs.key?(:begin_at)
      parsed, date_errors = RaceDateParams.call({ "begin_at" => attrs[:begin_at] }, zone: Time.zone, fields: %w[begin_at])
      date_errors.any? ? errors.merge!(date_errors) : @tier.begin_at = parsed["begin_at"]
    end
    errors
  end
end
