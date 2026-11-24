# The staff payments list: every completed payment, filtered and paged on the server. The page, the
# filters and the progress summary all come from this one object, so they always agree.
#
# - race_id: absent means the newest open race (the newest race if none is open); "all" means every race.
# - payment_type: a requirement id (within the chosen race).
# - status: paid, refunding, refunded, not_refundable or all (absent is all); see CompletedRequirement.payment_status_sql.
# - q: case-insensitive text matched against the team name, the account holder, the payer and the racers
#   (name or email).
module Payments
  class PaymentSearch
    PER_PAGE = 25
    STATUSES = %w[paid refunding refunded not_refundable].freeze

    def initialize(race_id: nil, payment_type: nil, status: nil, q: nil, page: nil)
      @race_param = race_id.to_s.strip.presence
      @payment_type = Integer(payment_type.to_s, 10, exception: false)
      @status = status.to_s.strip.presence_in(STATUSES)
      @q = q.to_s.strip.presence
      @page = [Integer(page.to_s, 10, exception: false) || 1, 1].max
    end

    # The page of payments, with everything the rows show preloaded (no per-row queries).
    def payments
      @payments ||= filtered(with_status: true)
        .select("completed_requirements.*", "#{CompletedRequirement.payment_status_sql} AS payment_status")
        .preload(:user, :refunded_by, requirement: :race, team: :user)
        .order("completed_requirements.created_at DESC, completed_requirements.id DESC")
        .limit(PER_PAGE).offset((page - 1) * PER_PAGE).to_a
    end

    def meta
      {
        page: page,
        per_page: PER_PAGE,
        total_count: total_count,
        total_pages: (total_count / PER_PAGE.to_f).ceil,
        refund_batch_limit: RefundBatch.max_size,
        summary: summary
      }
    end

    def filters
      {
        race_id: all_races? ? "all" : race&.id,
        races: races,
        payment_types: payment_types
      }
    end

    private

    attr_reader :page, :q, :status, :payment_type

    def all_races? = @race_param == "all"

    # nil when every race is listed, or when no race exists yet.
    def race
      return nil if all_races?

      @race ||= @race_param ? Race.find_by(id: Integer(@race_param, 10, exception: false)) : default_race
    end

    def default_race
      now = Time.current
      Race.where("registration_open <= ? AND registration_close >= ?", now, now).order(race_datetime: :desc, id: :desc).first ||
        Race.order(race_datetime: :desc, id: :desc).first
    end

    # An unknown race id lists nothing rather than every race.
    def unknown_race?
      @race_param.present? && !all_races? && race.nil?
    end

    def base
      CompletedRequirement.joins(:requirement, :team)
        .where(requirements: { type: %w[PaymentRequirement MockPaymentRequirement] })
    end

    # The filters shared by the page and the summary. The summary leaves the status out, so it can show how
    # many of the filtered payments are refunded whatever the status tab says.
    def filtered(with_status:)
      scope = base
      scope = scope.none if unknown_race?
      scope = scope.where(requirements: { race_id: race.id }) if race
      scope = scope.where(requirements: { id: payment_type }) if payment_type
      scope = scope.with_payment_status(status) if with_status && status
      scope = scope.where(search_sql, term: "%#{ActiveRecord::Base.sanitize_sql_like(q)}%") if q
      scope
    end

    def search_sql
      <<~SQL.squish
        teams.name ILIKE :term
        OR EXISTS (
          SELECT 1 FROM users payers WHERE payers.id = completed_requirements.user_id
            AND (payers.email ILIKE :term OR CONCAT_WS(' ', payers.first_name, payers.last_name) ILIKE :term)
        )
        OR EXISTS (
          SELECT 1 FROM users owners WHERE owners.id = teams.user_id
            AND (owners.email ILIKE :term OR CONCAT_WS(' ', owners.first_name, owners.last_name) ILIKE :term)
        )
        OR EXISTS (
          SELECT 1 FROM people racers WHERE racers.team_id = teams.id
            AND (racers.email ILIKE :term OR CONCAT_WS(' ', racers.first_name, racers.last_name) ILIKE :term)
        )
      SQL
    end

    def total_count
      @total_count ||= filtered(with_status: true).count
    end

    def summary
      @summary ||= begin
        count, refunded_count, total_cents, refunded_cents = filtered(with_status: false).pick(
          Arel.sql("COUNT(*)"),
          Arel.sql("COUNT(completed_requirements.refunded_at)"),
          Arel.sql("COALESCE(SUM(completed_requirements.amount_cents), 0)"),
          Arel.sql("COALESCE(SUM(completed_requirements.amount_cents) FILTER (WHERE completed_requirements.refunded_at IS NOT NULL), 0)")
        ) || [0, 0, 0, 0]
        { count: count, refunded_count: refunded_count, total_cents: total_cents.to_i, refunded_cents: refunded_cents.to_i }
      end
    end

    def races
      races = Race.includes(:requirements).order(race_datetime: :desc, id: :desc).to_a
      Race.preload_registration_data(races)
      races.map { |listed| { id: listed.id, name: listed.name, registration_status: listed.registration_status.to_s } }
    end

    # The payment requirements of the chosen race, so a filter can never return nothing. Empty for all races.
    def payment_types
      return [] unless race

      race.requirements.select { |requirement| requirement.is_a?(PaymentRequirement) }.sort_by(&:id)
        .map { |requirement| { id: requirement.id, name: requirement.name } }
    end
  end
end
