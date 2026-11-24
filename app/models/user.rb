# Copyright (C) 2013 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class User < ApplicationRecord
  before_validation :downcase_email
  # Tells the old address, so a hijacked account cannot quietly move its email elsewhere.
  after_update_commit :send_email_changed_notice, if: :saved_change_to_email?

  RESET_FIELDS = %i[password password_confirmation].freeze

  validates :first_name, :last_name, :phone, :email, presence: true
  validates :email, format: { :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i }
  validates :email, uniqueness: { case_sensitive: false }
  validate :email_must_be_lowercase

  has_many :completed_requirements
  has_many :teams
  # Refund batches are the audit of who refunded what, so a staff user who made one cannot be deleted.
  has_many :refund_batches, dependent: :restrict_with_error

  default_scope ->{ order(:last_name) }

  paginates_per 35

  # authlogic
  acts_as_authentic do |c|
    c.login_field = :email
    # validate_login_field removed in authlogic 6.x
    c.perishable_token_valid_for = 3.hours

    # In version 3.4.0, the default crypto_provider was changed from Sha512 to SCrypt.
    c.transition_from_crypto_providers = [Authlogic::CryptoProviders::Sha512]
    c.crypto_provider = Authlogic::CryptoProviders::SCrypt
  end

  # Password validations for authlogic 6.x
  # In Authlogic 6.x, we must add explicit password validations
  attr_accessor :password_confirmation
  validates :password, presence: true, length: { minimum: 8 }, confirmation: true, if: :require_password?
  validates :password_confirmation, presence: true, if: :require_password?

  # ---------------------------------------------------------------
  # role_model role support for cancan
  # http://rubydoc.info/gems/role_model/0.8.1/frames

  include RoleModel

  # declare the valid roles -- do not change the order if you
  # add more roles later, always append them at the end.
  roles :admin, :refunder, :operator

  # ---------------------------------------------------------------

  def phone=(val)
    super(PhoneNumber.normalize(val))
  end

  def gets_admin_menu?
    (is? :admin) || (is? :operator)
  end

  def fullname
    "#{first_name} #{last_name}"
  end

  def reset_password!(host)
    reset_perishable_token!
    Workers::PasswordResetEmail.perform_async({'user_id' => self.id, 'host' => host})
  end

  # Sets a new password from a reset link. Only the password is validated, so an older record that fails
  # a newer rule (e.g. a missing phone) can still reset. A valid token proves control of the inbox, so it
  # also lifts a brute-force lockout. Session maintenance is skipped: the caller logs the user in once.
  def reset_password_from_link(password, password_confirmation)
    self.password = password
    self.password_confirmation = password_confirmation
    self.failed_login_count = 0
    valid?
    password_errors = errors.select { |error| RESET_FIELDS.include?(error.attribute) }
    errors.clear
    password_errors.each { |error| errors.import(error) }
    errors.empty? && save_without_session_maintenance(validate: false)
  end

  private

  def send_email_changed_notice
    old_email = saved_change_to_email.first
    Workers::EmailChangedEmail.perform_async({ "user_id" => id, "old_email" => old_email }) if old_email.present?
  end

  def downcase_email
    self.email = email.downcase if email.present?
  end

  def email_must_be_lowercase
    return if email.blank?
    if email != email.downcase
      errors.add(:email, 'must be lowercase')
    end
  end
end
