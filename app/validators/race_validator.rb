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
class RaceValidator < ActiveModel::Validator

  def validate(record)
    validate_dates(record) if datetimes_parse?(record)
  end

  private

  def validate_dates(record)
    unless record.final_edits_close < record.race_datetime
      record.errors.add(:final_edits_close, 'must come before race_datetime')
    end
    unless record.registration_close < record.final_edits_close
      record.errors.add(:registration_close, 'must come before final_edits_close')
    end
    unless record.registration_open < record.registration_close
      record.errors.add(:registration_open, 'must come before registration_close')
    end
  end

  def datetimes_parse?(record)
    dates = [:race_datetime, :registration_open, :registration_close]
    dates.each do |d|
      begin
        DateTime.parse record.__send__(d).to_s
      rescue ArgumentError
        record.errors.add(d, 'must be a valid datetime')
      end
    end
    record.errors.count == 0
  end
end
