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
class TierValidator < ActiveModel::Validator

  def validate(record)
    validate_unique_begin_at(record)
    validate_unique_price(record)
  end

  private

  def validate_unique_begin_at(record)
    tiers = non_self_tiers(record)
    return unless tiers
    dates = tiers.map(&:begin_at)
    if dates.include? record.begin_at
      record.errors.add(:begin_at, 'must be unique per payment requirement')
    end
  end

  def validate_unique_price(record)
    tiers = non_self_tiers(record)
    return unless tiers.present?
    prices = tiers.map(&:price)
    if prices.include? record.price
      record.errors.add(:price, 'must be unique per payment requirement')
    end
  end

  # helper method

  def non_self_tiers(record)
    if record.requirement.present? && record.requirement.tiers.present?
      tiers = record.requirement.tiers
      tiers.reject { |t| t == record }
    end
  end
end
