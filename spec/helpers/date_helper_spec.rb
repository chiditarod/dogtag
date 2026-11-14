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
require 'spec_helper'

describe DateHelper, type: :helper do
  let(:chicago) { ActiveSupport::TimeZone["America/Chicago"] }
  let(:thedate) { chicago.local(2013, 2, 15, 0, 0, 0) }

  describe "#human_readable" do
    it "returns a human-readable datetime with the zone abbreviation" do
      expect(human_readable(thedate)).to eq("February 15, 2013 at 12:00 AM CST")
    end

    it "uses the daylight abbreviation in summer" do
      expect(human_readable(chicago.local(2027, 7, 1, 9, 5))).to eq("July 1, 2027 at 9:05 AM CDT")
    end
  end

  describe "#human_readable_short" do
    it "returns a short human-readable datetime with the zone abbreviation" do
      expect(human_readable_short(thedate)).to eq("Feb 15, 12:00 AM CST")
    end
  end

  describe "#human_date" do
    it "returns the date only" do
      expect(human_date(chicago.local(2027, 2, 5, 13))).to eq("February 5, 2027")
    end
  end

  describe "midnight deadline rule" do
    let(:midnight) { chicago.local(2027, 2, 15) }

    it "shows a midnight deadline as 11:59 PM on the previous day" do
      expect(deadline_readable(midnight)).to eq("February 14, 2027 at 11:59 PM CST")
      expect(deadline_date(midnight)).to eq("February 14, 2027")
    end

    it "applies the rule in the time's own zone" do
      utc_midnight_is_chicago_evening = Time.utc(2027, 2, 15).in_time_zone(chicago)
      expect(deadline_date(utc_midnight_is_chicago_evening)).to eq("February 14, 2027")
      expect(deadline_readable(utc_midnight_is_chicago_evening)).to eq("February 14, 2027 at 6:00 PM CST")
    end

    it "leaves other times alone" do
      one_second_past = midnight + 1.second
      expect(deadline_readable(one_second_past)).to eq("February 15, 2027 at 12:00 AM CST")
      expect(deadline_date(chicago.local(2027, 2, 15, 18))).to eq("February 15, 2027")
    end
  end
end
