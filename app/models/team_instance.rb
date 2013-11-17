class TeamInstance < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name, :scope => [:race], :message => "should be unique per race"
  validates_uniqueness_of :twitter, :scope => [:race], :allow_nil => true, :message => "should be unique per race"
  validates_with TeamInstanceValidator

  belongs_to :team
  belongs_to :race

  has_many :people
end
