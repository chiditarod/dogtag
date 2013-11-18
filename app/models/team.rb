class Team < ActiveRecord::Base
  #has_and_belongs_to_many :users
  has_many :registrations
  has_many :races, :through => :registrations
end
