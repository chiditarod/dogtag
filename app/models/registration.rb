class Registration < ActiveRecord::Base
  validates_presence_of :name, :description
  validates_uniqueness_of :name, :scope => [:race], :message => 'should be unique per race'
  validates_uniqueness_of :twitter, :scope => [:race], :allow_nil => true, :allow_blank => true, :message => 'needs to be unique per race'
  validates_format_of :twitter, :with => /\A^@\w+\z/i, :allow_nil => true, :allow_blank => true, :message => 'needs to begin with @, be a single, word, and not have weird characters'

  # A registration is the intermediary model between a team and race.
  # The team <-> race association must be unique
  belongs_to :team
  belongs_to :race
  validates_presence_of :team, :race
  validates_uniqueness_of :team, :scope => [:race], :allow_nil => true, :message => 'is already registered for this race. go create another team'
  validates_uniqueness_of :race, :scope => [:team], :allow_nil => true, :message => 'already has this team registered'
  validates_with RegistrationValidator

  # A registration has a certain number of people, per the settings for the race.
  has_many :people

  # A registration must track which race requirements have been fulfilled.
  has_many :completed_requirements
  has_many :requirements, :through => :completed_requirements

  # Other fields (originally JsonForm-bound but whatevs)

  VALID_RACER_TYPES = %w(racer art_cart)

  validates_presence_of :racer_type, :primary_inspiration, :experience
  validates_acceptance_of :rules_confirmation, :sabotage_confirmation,
    :cart_deposit_confirmation, :food_confirmation, :accept => true
  validates :experience, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates_inclusion_of :racer_type, in: VALID_RACER_TYPES

  EXPERIENCE_LEVELS = ["Zero. Fresh meat",
                       "1st year veterans",
                       "2nd year sophmorons",
                       "3rd year's a charm",
                       "4th year senioritis",
                       "5th year repeat offenders",
                       "6th year and we're still drunk",
                       "7th years of good luck",
                       "8th year elite",
                       "9th year elders"]

  INSPIRATIONS = ["Speed / 1st Place", "Art", "Costuming & Themes",
                  "Contests", "Charity", "Pleasure", "Sabotage", "Spectable",
                  "Fundraising", "Foodraising", "The Experience, Man", "DFL", "I am heavily uninspired"]

  def needs_people?
    (race.people_per_team - people.count) > 0
  end

  def is_full?
    ! needs_people?
  end

  def completed_all_requirements?
    return true if race.requirements.blank?
    race.requirements.select(&:enabled?) == requirements
  end

  def finalized?
    completed_all_requirements? && is_full?
  end

  # TODO - finish this
  def waitlist_position
    # assume we are not on the waitlist if race is not full
    return false if race.not_full?
    # assume we are not on the waitlist if our requirements are met
    return false if finalized?
  end

  class << self
    def racer_types_optionlist
      VALID_RACER_TYPES.map { |r| [r.to_s.humanize, r] }
    end
  end
end
