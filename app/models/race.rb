class Race < ActiveRecord::Base
  validates_presence_of :name, :race_datetime, :max_teams, :people_per_team
  validates :max_teams, :people_per_team, :numericality => {
    :only_integer => true,
    :greater_than => 0
  }
  validates_uniqueness_of :name
  validates_with RaceValidator

  has_many :registrations
  has_many :teams, -> {distinct}, :through => :registrations

  def full?
    registrations.count == max_teams ? true : false
  end

end
