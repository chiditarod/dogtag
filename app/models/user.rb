class User < ActiveRecord::Base
  validates_presence_of :first_name, :last_name, :phone, :email
  validates_format_of :email, :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i
  validates_format_of :phone, :with => /\A\d{3}-\d{3}-\d{4}\z/, :message => "should be in the form 555-867-5309"
  validates_uniqueness_of :email

  has_many :completed_requirements
  has_many :teams

  # cancan
  acts_as_authentic do |c|
    c.login_field = :email
    c.validate_login_field = false
  end

  # ---------------------------------------------------------------
  # role_model role support for cancan
  # http://rubydoc.info/gems/role_model/0.8.1/frames

  include RoleModel

  # declare the valid roles -- do not change the order if you
  # add more roles later, always append them at the end.
  roles :admin, :refunder, :operator

  # ---------------------------------------------------------------

  def gets_admin_menu?
    (is? :admin) || (is? :operator)
  end

  def fullname
    "#{first_name} #{last_name}"
  end

  def deliver_password_reset_instructions!(host)
    reset_perishable_token!
    UserMailer.password_reset_instructions(self, host).deliver
  end
end
