# Fees (payment requirements) for staff (operator, admin). Refunders pass the base controller's
# check but not the ability ones, so they get 403 here. Prices are handled by TiersController.
class Api::V1::Staff::RequirementsController < Api::V1::Staff::BaseController
  include RaceTimeZone
  include StaffFeeParams

  TYPE_CHANGE_ERROR = "can't be changed after the fee is created".freeze

  # Staff-level access is checked before anything that can answer 400 or 404, so a refunder
  # learns nothing about which races exist or what a body should look like.
  before_action -> { authorize!(:index, PaymentRequirement) }, only: [:index]
  before_action -> { authorize!(:create, PaymentRequirement) }, only: [:create]
  before_action :load_race, only: [:index, :create]
  before_action :load_requirement, only: [:show, :update, :destroy]
  # The start time is a wall clock in the race's own zone.
  around_action :use_race_time_zone, only: [:create]

  def index
    @requirements = fees.where(race_id: @race.id).includes(:tiers).order(:id).to_a
    @types = types
    @payment_counts = payment_counts(@requirements)
  end

  def show
    authorize!(:show, @requirement)
    prepare_show
  end

  def create
    requirement_attrs, tier_attrs = params.expect(requirement: [:name, :type], tier: [:price, :begin_at])
    type = requirement_attrs[:type]

    @requirement = (types.include?(type) ? Requirement.new(type:) : PaymentRequirement.new)
    @requirement.assign_attributes(name: requirement_attrs[:name], race: @race)
    authorize!(:create, @requirement)

    tier, date_errors = build_tier(tier_attrs)
    errors = {}
    @requirement.valid?
    @requirement.errors.each { |error| (errors[error.attribute.to_s] ||= []) << error.message }
    errors["type"] = ["Choose a type"] unless types.include?(type)
    errors.merge!(tier_errors(tier, tier_attrs[:price], date_errors))
    return render_errors_hash(errors) if errors.any?

    Requirement.transaction do
      @requirement.save!
      tier.save!
    end
    @requirement.tiers.reset
    prepare_show
    render :show, status: :created
  end

  def update
    authorize!(:update, @requirement)
    attrs = params.expect(requirement: [:name, :type])
    if attrs.key?(:type)
      @requirement.errors.add(:type, TYPE_CHANGE_ERROR)
      return render_errors(@requirement)
    end

    return render_errors(@requirement) unless @requirement.update(attrs.slice(:name))

    prepare_show
    render :show
  end

  def destroy
    authorize!(:destroy, @requirement)
    return head :no_content if @requirement.destroy

    render_errors(@requirement.errors.full_messages.to_sentence, code: "fee_has_payments")
  end

  private

  # Only the payment types are fees; the type list rather than PaymentRequirement.where, whose
  # subclasses are not all known while classes load lazily.
  def fees
    Requirement.where(type: types)
  end

  def types
    Requirement.allowed_types.map(&:last)
  end

  def load_race
    @race = Race.find(params[:race_id])
  end

  def load_requirement
    @requirement = fees.includes(:tiers).find(params[:id])
    @race = @requirement.race
  end

  # Used by the around_action: the race being added to, else the one the fee belongs to.
  def race_time_zone
    @race&.time_zone
  end

  def prepare_show
    @payment_counts = payment_counts([@requirement])
  end

  # { requirement_id => { total:, unrefunded: } } in one grouped query.
  def payment_counts(requirements)
    rows = CompletedRequirement.where(requirement_id: requirements.map(&:id)).group(:requirement_id)
      .pluck(:requirement_id, Arel.sql("COUNT(*)"), Arel.sql("COUNT(*) FILTER (WHERE refunded_at IS NULL)"))
    rows.to_h { |id, total, unrefunded| [id, { total:, unrefunded: }] }
      .tap { |counts| counts.default = { total: 0, unrefunded: 0 } }
  end

  # The first price, with the start time read in Time.zone (the race's, set by the around_action).
  # Returns [tier, date_errors]; a start that could not be read is left unassigned.
  def build_tier(attrs)
    parsed, date_errors = RaceDateParams.call({ "begin_at" => attrs[:begin_at] }, zone: Time.zone, fields: %w[begin_at])
    price = attrs[:price]
    [Tier.new(requirement: @requirement, price: (price if price.is_a?(Integer)), begin_at: parsed["begin_at"]), date_errors]
  end

  # { "tier.price" => [...], "tier.begin_at" => [...] }. The whole-dollar rule replaces the model's
  # price messages, and a start that could not be read replaces its "can't be blank".
  def tier_errors(tier, price, date_errors)
    tier.valid?
    tier.errors.delete(:price)
    tier.errors.delete(:begin_at) if date_errors.key?("begin_at")
    messages = tier.errors.to_hash.transform_keys(&:to_s).merge(date_errors)
    price_error = whole_dollar_error(price)
    messages["price"] = [price_error] if price_error
    messages.transform_keys { |field| "tier.#{field}" }
  end

  def render_errors_hash(errors)
    render json: { error: "invalid", errors: }, status: :unprocessable_entity
  end
end
