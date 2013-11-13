class Racer < ActiveRecord::Base
  validates_presence_of :first_name, :last_name, :email, :phone
  validates_format_of :email, :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i

  belongs_to :team
end
