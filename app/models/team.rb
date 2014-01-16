class Team < ActiveRecord::Base
  validates_presence_of :name
  validates_uniqueness_of :name

  belongs_to :user

  has_many :races, :through => :registrations
  has_many :registrations
end
