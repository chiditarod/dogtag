class Race < ActiveRecord::Base
  validates_presence_of :name, :max_teams, :people_per_team
  validates_presence_of :race_datetime, :registration_open, :registration_close
  validates :max_teams, :people_per_team, :numericality => {
    :only_integer => true,
    :greater_than => 0
  }
  validates_uniqueness_of :name
  validates_with RaceValidator

  scope :past, -> { where("race_datetime < ?", Time.now) }
  scope :current, -> { where("race_datetime > ?", Time.now) }

  has_many :teams

  # Each race has different registration requirements that needs
  # to be fulfilled before a team is fully registered.
  has_many :requirements

  def enabled_requirements
    requirements.select(&:enabled?)
  end

  # If :force => true, refresh the cache
  def finalized_teams(params={})
    options = { expires_in: 1.hour, race_condition_ttl: 10.seconds }.merge(params)
    Rails.cache.fetch("finalized_teams_#{id}", options) do
      teams.select(&:finalized?)
    end
  end

  def spots_remaining
    max_teams - finalized_teams.count
  end

  def waitlist_count
    return 0 if not_full?
    teams.count - max_teams
  end

  # todo - this works in rails console but spec it out
  def waitlisted_teams
    Team.where(:race_id => self.id).order(:created_at => :desc).reject { |x| x.finalized? }
  end

  def over?
    return true if race_datetime < Time.now
  end

  def full?
    finalized_teams.count >= max_teams
  end

  def not_full?
    !full?
  end

  def open_for_registration?
    now = Time.now
    return false if now < registration_open
    return false if registration_close < now
    true
  end

  def registration_over?
    registration_close < Time.now
  end

  def registerable?
    not_full? && open_for_registration?
  end

  def days_before_close
    t = Time.now
    return false if registration_close < t
    (registration_close - t).ceil
  end

  class << self
    def find_registerable_races
      Race.all.select(&:registerable?)
    end

    def find_open_races
      Race.all.select(&:open_for_registration?)
    end
  end
end
