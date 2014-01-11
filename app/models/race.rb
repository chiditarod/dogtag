class Race < ActiveRecord::Base
  validates_presence_of :name, :max_teams, :people_per_team
  validates_presence_of :race_datetime, :registration_open, :registration_close
  validates :max_teams, :people_per_team, :numericality => {
    :only_integer => true,
    :greater_than => 0
  }
  validates_uniqueness_of :name
  validates_with RaceValidator

  # Registrations are the intermediary model between a team registering for a race.
  has_many :registrations
  has_many :teams, -> {distinct}, :through => :registrations

  # Each race has different registration requirements that needs
  # to be fulfilled before a team is fully registered.
  has_many :requirements

  def enabled_requirements
    requirements.select(&:enabled?)
  end

  def full?
    registrations.count == max_teams
  end

  def not_full?
    !full?
  end

  def spots_remaining
    max_teams - registrations.count
  end

  def open?
    now = Time.now
    return false if now < registration_open
    return false if registration_close < now
    true
  end

  def registerable?
    not_full? && open?
  end

  def closes_in
    return false unless registerable?
    (registration_close - Time.now).round
  end

  class << self
    def find_registerable_races
      Race.all.select do |race|
        race if race.registerable?
      end
    end
  end

end
