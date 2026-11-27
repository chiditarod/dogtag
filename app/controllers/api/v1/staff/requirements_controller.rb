# Fees (payment requirements) for staff (operator, admin). Refunders pass the base controller's
# check but not the ability ones, so they get 403 here. Prices are handled by TiersController.
class Api::V1::Staff::RequirementsController < Api::V1::Staff::BaseController
  include RaceTimeZone
  include StaffFeeParams
  include StaffFees

  TYPE_CHANGE_ERROR = "can't be changed after the fee is created".freeze

  # Staff-level access is checked before anything that can answer 400 or 404, so a refunder
  # learns nothing about which races exist or what a body should look like.
  before_action -> { authorize!(:index, PaymentRequirement) }, only: [:index]
  before_action -> { authorize!(:create, PaymentRequirement) }, only: [:create]
  before_action -> { authorize!(:show, PaymentRequirement) }, only: [:show]
  before_action -> { authorize!(:update, PaymentRequirement) }, only: [:update]
  before_action -> { authorize!(:destroy, PaymentRequirement) }, only: [:destroy]
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
    render_fee
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
    return render_field_errors(errors) if errors.any?

    Requirement.transaction do
      @requirement.save!
      tier.save!
    end
    render_fee(status: :created, reload: true)
  end

  def update
    authorize!(:update, @requirement)
    attrs = params.expect(requirement: [:name, :type])
    if attrs.key?(:type)
      @requirement.errors.add(:type, TYPE_CHANGE_ERROR)
      return render_errors(@requirement)
    end

    return render_errors(@requirement) unless @requirement.update(attrs.slice(:name))

    render_fee
  end

  def destroy
    authorize!(:destroy, @requirement)
    return head :no_content if @requirement.destroy

    render_errors(@requirement.errors.full_messages.to_sentence, code: "fee_has_payments")
  end

  private

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
end
