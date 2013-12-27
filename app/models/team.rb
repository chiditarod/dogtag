class Team < ActiveRecord::Base
  validates_presence_of :name

  has_and_belongs_to_many :users
  has_many :races, :through => :registrations
  has_many :registrations

  class << self
    def find_by_user(user)
      Team.where(:id => user.id)
    end
  end

end
