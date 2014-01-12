class Registration < ActiveRecord::Base
  validates_presence_of :name
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
end
