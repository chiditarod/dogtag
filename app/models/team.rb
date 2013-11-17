class Team < ActiveRecord::Base
  has_many :team_instances
  has_many :races, :through => :team_instances
end
