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
  validates :first_name, :last_name, :phone, :email, presence: true
  validates :phone, format: { :with => /\A\d{3}-\d{3}-\d{4}\z/, :message => "should be in the form 555-867-5309" }

  # AuthLogic 4.4.3 -> 5.2.0
  # see: https://github.com/binarylogic/authlogic/blob/master/doc/use_normal_rails_validation.md
  validates :email,
    format: {
      with: /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i,
      message: "should look like an email address."
    },
    length: { maximum: 100 },
    uniqueness: {
      case_sensitive: false,
      if: :will_save_change_to_email?
    }
  validates :password,
    confirmation: { if: :require_password? },
    length: {
      minimum: 8,
      if: :require_password?
    }
  validates :password_confirmation,
    length: {
      minimum: 8,
      if: :require_password?
  }

  has_many :completed_requirements
  has_many :teams

  default_scope ->{ order(:last_name) }

  paginates_per 35

  # authlogic
  acts_as_authentic do |c|
    c.login_field = :email
    c.perishable_token_valid_for = 3.hours

    # In version 3.4.0, the default crypto_provider was changed from Sha512 to SCrypt.
    c.transition_from_crypto_providers = [Authlogic::CryptoProviders::Sha512]
    c.crypto_provider = Authlogic::CryptoProviders::SCrypt
  end

  # ---------------------------------------------------------------
  # role_model role support for cancan
  # http://rubydoc.info/gems/role_model/0.8.1/frames

  include RoleModel

  # declare the valid roles -- do not change the order if you
  # add more roles later, always append them at the end.
  roles :admin, :refunder, :operator

  # ---------------------------------------------------------------

  include ActionView::Helpers::NumberHelper
  def phone=(val)
    super(number_to_phone(val, area_code: false, delimiter: '-'))
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
end
