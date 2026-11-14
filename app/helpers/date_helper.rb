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
module DateHelper
  # Callers pass a time already in the race's zone (race.local(time)) so %Z
  # prints the right abbreviation.
  def human_readable(datetime)
    datetime.strftime "%B %-d, %Y #{I18n.t('at')} %-l:%M %p %Z"
  end

  def human_readable_short(datetime)
    datetime.strftime "%b %-d, %-l:%M %p %Z"
  end

  def human_date(datetime)
    datetime.strftime "%B %-d, %Y"
  end

  def human_date_short(datetime)
    datetime.strftime "%b %-d, %Y"
  end

  # Deadlines (registration close, final edits close) set at exactly local
  # midnight read as 11:59 PM the day before, so "closes Feb 15" is not taken
  # to mean the end of Feb 15. Use these for deadlines only, not for openings.
  def deadline_readable(datetime)
    human_readable(deadline_display_time(datetime))
  end

  def deadline_date(datetime)
    human_date(deadline_display_time(datetime))
  end

  private

  def deadline_display_time(datetime)
    datetime.seconds_since_midnight.zero? ? datetime - 1.minute : datetime
  end
end
