class Race < ActiveRecord::Base
  validates_presence_of :name, :max_teams, :people_per_team
  validates_presence_of :race_datetime, :registration_open, :registration_close
  validates :max_teams, :people_per_team, :numericality => {
    :only_integer => true,
    :greater_than => 0
  }
  validates :classy_campaign_id, :classy_default_goal, numericality: {
    only_integer: true,
    greater_than: 0,
    allow_nil: true
  }
  validates_uniqueness_of :name
  validates_with RaceValidator

  # todo: validate filter_field based on contents of jsonform schema

  scope :past,    -> { where("race_datetime < ?", Time.zone.now) }
  scope :current, -> { where("race_datetime > ?", Time.zone.now) }

  has_many :teams
  MAX_TEAMS_PER_RACE = 4096 # arbitrary number of maximum teams per race.

  # Each race has different registration requirements that needs
  # to be fulfilled before a team is fully registered.
  has_many :requirements

  def question_fields
    return [] unless jsonform.present?
    JSON.parse(jsonform)['schema']['properties'].keys
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

  def over?
    race_datetime < Time.zone.now
  end

  def full?
    finalized_teams.size >= max_teams
  end

  def not_full?
    !full?
  end

  def open_for_registration?
    now = Time.zone.now
    return false if now < registration_open
    return false if registration_close < now
    true
  end

  def registration_over?
    registration_close < Time.zone.now
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

  def self.find_registerable_races
    Race.all.select(&:registerable?)
  end

  def self.find_open_races
    Race.all.select(&:open_for_registration?)
  end
end
