# Copyright (C) 2013 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class Race < ApplicationRecord
  CONFIRMATION_TEXT_MAX_LENGTH = 5000

  validates :name, :max_teams, :people_per_team, presence: true
  validates :race_datetime, :registration_open, :registration_close, :final_edits_close, presence: true
  validates :max_teams, :people_per_team, :numericality => {
    :only_integer => true,
    :greater_than => 0
  }
  validates :classy_campaign_id, :classy_default_goal, numericality: {
    only_integer: true,
    greater_than: 0,
    allow_nil: true
  }
  validates :name, uniqueness: true
  validates :confirmation_text, length: { maximum: CONFIRMATION_TEXT_MAX_LENGTH, message: :too_long_text }, allow_blank: true
  validate :time_zone_must_be_iana
  validates_with RaceValidator

  # Datetimes are stored in UTC; the race's IANA time zone is how admins
  # enter them and how racers see them.
  DEFAULT_TIME_ZONE = "America/Chicago".freeze

  # Only the IANA ids the admin select offers (Rails' zone list). Browsers'
  # Intl knows all of them, so the SPA never silently falls back to Chicago.
  def self.selectable_time_zones
    @selectable_time_zones ||= ActiveSupport::TimeZone.all.map { |zone| zone.tzinfo.name }.to_set.freeze
  end

  def self.valid_time_zone?(name) = selectable_time_zones.include?(name)

  # todo: validate filter_field based on contents of jsonform schema

  scope :past,    -> { where("race_datetime < ?", Time.zone.now) }
  scope :current, -> { where("race_datetime > ?", Time.zone.now) }

  has_many :teams
  MAX_TEAMS_PER_RACE = 4096 # arbitrary number of maximum teams per race.

  # Each race has different registration requirements that needs
  # to be fulfilled before a team is fully registered.
  has_many :requirements

  DEFAULT_EXPERIENCE_LABELS = [
    "Zero. Fresh meat",
    "1st year veterans",
    "2nd year sophmorons",
    "3rd year's a charm",
    "4th year senioritis",
    "5th year repeat offenders",
    "6th year and we're still drunk",
    "7th years of good luck",
    "8th year elite",
    "9th year elders",
    "10th year anniversary",
    "11th year OGs",
    "12th year sages",
    "13th year fingers crossed",
    "14th year clumsy adolescents",
    "15th year student drivers",
    "Sweet 16th",
    "17th year.. wait, what?",
    "18th year I'M AN ADULT",
    "19th year wait are you seriously still doing this?",
    "XX",
    "21st year finally legal",
    "22nd year: old enough to know better"
  ].freeze

  # The given time in this race's zone, e.g. race.local(race.registration_close).
  def local(time) = time&.in_time_zone(time_zone)

  # Labels for the "years racing" select; the index is the number of years.
  def experience_labels
    super.presence || DEFAULT_EXPERIENCE_LABELS
  end

  def experience_label(index)
    i = index.to_i
    (experience_labels[i] if i >= 0) || "#{index} years"
  end

  def experience_labels_text
    experience_labels.join("\n")
  end

  def experience_labels_text=(text)
    self.experience_labels = text.to_s.lines.map(&:strip).reject(&:blank?)
  end

  def question_fields
    return [] unless jsonform.present?
    JSON.parse(jsonform).dig('schema', 'properties')&.keys || []
  rescue => e
    Rails.logger.error "Could not retrieve possible jsonschema filter fields: #{e}"
    []
  end

  def filter_field_array
    return [] if filter_field.nil?
    filter_field.split(',')
  end

  def enabled_requirements
    requirements.select(&:enabled?)
  end

  # Loads what the API's race JSON needs for many races in a fixed number of queries:
  # payment tiers (not preloadable through `requirements`, which mixes STI types) and the
  # finalized team counts behind `full?`. Expects `requirements` to be loaded already.
  def self.preload_registration_data(races)
    races = races.uniq
    payment_requirements = races.flat_map(&:requirements).grep(PaymentRequirement)
    ActiveRecord::Associations::Preloader.new(records: payment_requirements, associations: :tiers).call

    counts = Team.all_finalized.where(race_id: races.map(&:id)).group(:race_id).count
    races.each { |race| race.finalized_teams_count = counts.fetch(race.id, 0) }
  end

  # Reads only loaded requirements and tiers, so it adds no queries after
  # Race.preload_registration_data.
  def setup_problems
    fees = requirements.select { |requirement| requirement.is_a?(PaymentRequirement) }
    problems = []
    problems << "No fee set up" if fees.empty?
    fees.each do |fee|
      tiers = fee.tiers.to_a
      if tiers.empty?
        problems << "#{fee.name} has no price"
      elsif (begins = tiers.filter_map(&:begin_at)).empty? || begins.min > registration_open
        problems << "#{fee.name} has no price when registration opens"
      end
    end
    problems << "Questions (JSONForm) don't parse" if jsonform_unparseable?
    problems
  end

  # Gross, refunded and net payment money for the race, in one query.
  def money_totals
    gross, refunded = CompletedRequirement
      .joins(:team)
      .where(teams: { race_id: id })
      .pick(Arel.sql("COALESCE(SUM(amount_cents), 0)"),
            Arel.sql("COALESCE(SUM(amount_cents) FILTER (WHERE refunded_at IS NOT NULL), 0)"))
    { gross_cents: gross.to_i, refunded_cents: refunded.to_i, net_cents: gross.to_i - refunded.to_i }
  end

  # Set only by preload_registration_data, for the lifetime of one request's objects.
  attr_writer :finalized_teams_count

  def finalized_teams
    Team.all_finalized.where(race_id: id)
  end

  def spots_remaining
    max_teams - finalized_teams.size
  end

  def waitlist_count
    return 0 if not_full?
    teams.size - max_teams
  end

  def waitlisted_teams
    return [] if not_full?
    Team.all_unfinalized.where(race_id: id).order(:created_at)
  end

  def over?
    race_datetime < Time.zone.now
  end

  # Captains can start a team only while registration is open; admins and operators
  # can add one at any time (e.g. a late entry). Shared by the legacy and API flows.
  def accepts_new_teams_from?(user)
    open_for_registration? || user.is_any_of?(:admin, :operator)
  end

  def full?
    (@finalized_teams_count || finalized_teams.size) >= max_teams
  end

  def not_full?
    !full?
  end

  def not_yet_open?
    Time.zone.now < registration_open
  end

  def open_for_registration?
    now = Time.zone.now
    return false if now < registration_open
    return false if now > registration_close
    true
  end

  def registration_over?
    registration_close < Time.zone.now
  end

  # Position of each status in the race list: races a racer can act on come first.
  REGISTRATION_STATUS_RANKS = { open: 0, waitlist: 1, closed: 2, not_yet_open: 3 }.freeze

  # :open and :waitlist are open_for_registration?; :closed covers everything after
  # registration closes (race datetime still ahead for any race in Race.current).
  def registration_status
    return :not_yet_open if not_yet_open?
    return :closed unless open_for_registration?

    full? ? :waitlist : :open
  end

  # Sort key for the race list: status rank, then soonest race (soonest opening for
  # not-yet-open races), then id. The rank comes first, so times from different
  # groups are never compared.
  def registration_sort_key
    status = registration_status
    [REGISTRATION_STATUS_RANKS.fetch(status), status == :not_yet_open ? registration_open : race_datetime, id]
  end

  def in_final_edits_window?
    now = Time.zone.now
    return false if now < registration_close
    return false if now > final_edits_close
    true
  end

  def registerable?
    not_full? && open_for_registration?
  end

  def days_before_close
    t = Time.zone.now
    return false if registration_close < t
    (registration_close - t).ceil
  end

  def stats
    money_raised = teams.reduce(0) do |memo, team|
      memo + team.money_paid_in_cents
    end

    {
      'money_raised' => money_raised
    }
  end

  private

  def jsonform_unparseable?
    return false if jsonform.blank?
    JSON.parse(jsonform)
    false
  rescue JSON::ParserError
    true
  end

  def time_zone_must_be_iana
    errors.add(:time_zone, "must be an IANA time zone, e.g. #{DEFAULT_TIME_ZONE}") unless Race.valid_time_zone?(time_zone)
  end
end
