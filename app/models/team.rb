class Team < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name

  has_and_belongs_to_many :users
  has_many :races, :through => :registrations
  has_many :registrations
end
