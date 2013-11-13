class Team < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name, :scope => [:race]
  validates_uniqueness_of :twitter, :scope => [:race], :allow_nil => true
  validates_with TeamValidator

  belongs_to :race
  has_many :racers
end
