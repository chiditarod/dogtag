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
class Person < ApplicationRecord
  before_validation :downcase_email, :normalize_instagram

  validates :first_name, :last_name, :email, :phone, :zipcode, presence: true
  validates :email, format: { :with => /\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\z/i }
  validate :email_must_be_lowercase
  # Once per team. Only checked when the email is new or changed, so older teams that
  # already share an address stay editable.
  validates :email, uniqueness: { scope: :team_id, message: :taken_on_team },
                    if: -> { new_record? || will_save_change_to_email? }
  # Instagram allows letters, numbers, periods and underscores, but no period
  # at either end and never two in a row.
  validates :instagram, allow_nil: true, format: {
    with: /\A@(?!\.)(?!.*\.\.)[a-z0-9._]{1,30}(?<!\.)\z/, message: :invalid_handle
  }
  validates :zipcode, format: { :with => /\A\d{5}(-\d{4})?\z/, :message => "should be in the form 12345 or 12345-1234" }
  validates :phone, format: { :with => /\A\d{3}-\d{3}-\d{4}\z/, :message => "should be in the form 555-867-5309" }
  validates :experience, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates_with PersonValidator

  include Wisper.model

  belongs_to :team

  after_save :refresh_team_new_flag, if: -> { saved_change_to_experience? || saved_change_to_team_id? }
  after_destroy :refresh_team_new_flag

  def phone=(val)
    super(PhoneNumber.normalize(val))
  end

  def self.registered_for_race(race_id)
    race = Race.find race_id
    race.finalized_teams.inject([]) do |total, reg|
      total.concat(reg.people.reject{ |person| person.email.downcase =~ /unknown/})
    end
  end

  private

  def refresh_team_new_flag
    Team.find_by(id: team_id_before_last_save)&.refresh_new_team if saved_change_to_team_id? && team_id_before_last_save
    team&.refresh_new_team
  end

  def downcase_email
    self.email = email.downcase if email.present?
  end

  def normalize_instagram
    # [[:space:]] also strips a non-breaking space pasted from a profile page.
    handle = instagram.to_s.gsub(/\A[[:space:]]+|[[:space:]]+\z/, "").downcase.delete_prefix("@")
    self.instagram = handle.empty? ? nil : "@#{handle}"
  end

  def email_must_be_lowercase
    return if email.blank?
    if email != email.downcase
      errors.add(:email, 'must be lowercase')
    end
  end
end
