class User < ActiveRecord::Base
  attr_accessible :email, :first_name, :last_name, :phone, :password, :password_confirmation

  validates_presence_of :first_name, :last_name, :phone, :email
  validates_format_of :email, :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i
  validates_uniqueness_of :email

  #has_many :teams
  #belongs_to :team, :class_name => Team, :foreign_key => "team_id"

  acts_as_authentic do |c|
    c.login_field = :email
    c.validate_login_field = false
  end

end
