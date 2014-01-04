class Registration < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name, :scope => [:race], :message => 'should be unique per race'
  validates_uniqueness_of :twitter, :scope => [:race], :allow_nil => true, :allow_blank => true, :message => 'needs to be unique per race'
  validates_format_of :twitter, :with => /\A^@\w+\z/i, :allow_nil => true, :allow_blank => true, :message => 'needs to begin with @ and be one word'
  validates_with RegistrationValidator

  # A registration is the intermediary model between a team and race.
  # The team <-> race association must be unique
  belongs_to :team
  belongs_to :race
  validates_presence_of :team, :race
  validates_uniqueness_of :team, :scope => [:race], :allow_nil => true, :message => 'is already registered for this race. go create another team'
  validates_uniqueness_of :race, :scope => [:team], :allow_nil => true, :message => 'already has this team registered'

  # A registration has a certain number of people, per the settings for the race.
  has_many :people

  # A registration needs to keep track of which requirements have been fulfilled.
  has_many :requirements, :as => :fulfilled_requirements,
    :through => :registration_requirements

end
