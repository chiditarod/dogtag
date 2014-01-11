class User < ActiveRecord::Base
  validates_presence_of :first_name, :last_name, :phone, :email
  validates_format_of :email, :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i
  validates_uniqueness_of :email

  has_and_belongs_to_many :teams

  acts_as_authentic do |c|
    c.login_field = :email
    c.validate_login_field = false
  end

  def fullname
    "#{first_name} #{last_name}"
  end

  def has_teams_for(race)
    return false unless teams.present?
    teams.reduce(false) do |open_team, team|
      val = open_team || team.registrations.empty?
      val || team.registrations.reduce(false) do |open_reg, reg|
        open_reg || (reg.race != race)
      end
    end
  end

end
