class Registration < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name, :scope => [:race], :message => 'should be unique per race'
  validates_uniqueness_of :twitter, :scope => [:race], :allow_nil => true, :allow_blank => true, :message => 'should be unique per race'
  validates_format_of :twitter, :with => /\A^@\w+\z/i, :allow_nil => true, :allow_blank => true, :message => 'should begin with @'
  validates_with RegistrationValidator

  # A registration is the intermediary model between a team and race.
  # The team <-> race association must be unique
  belongs_to :team
  belongs_to :race
  validates_presence_of :team, :race
  validates_uniqueness_of :team, :scope => [:race], :allow_nil => true
  validates_uniqueness_of :race, :scope => [:team], :allow_nil => true

  has_many :people
end
