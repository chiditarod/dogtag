# Copyright (C) 2014 Devin Breen
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
class Tier < ApplicationRecord
  validates :price, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates :begin_at, presence: true
  validates_with TierValidator

  # Single Table Inheritance: PaymentRequirement
  belongs_to :requirement

  before_destroy :refuse_destroy_of_last_paid_price, prepend: true

  # A paid fee keeps at least one price, or its payments would have nothing to show.
  def destroy_blocked_reason
    return unless requirement && requirement.payments? && Tier.where(requirement_id: requirement_id).count == 1

    "Can't delete the only price of a fee teams have paid."
  end

  def to_s
    "#{price}"
  end

  private

  def refuse_destroy_of_last_paid_price
    reason = destroy_blocked_reason
    return unless reason

    errors.add(:base, reason)
    throw :abort
  end
end
