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

describe DateHelper do
  let(:thedate) { DateTime.parse("2013-02-15 00:00:00") }

  describe '#human_readable', :type => :helper do
    it 'returns human-readable datetime' do
      expect(human_readable(thedate)).to eq("February 15, 2013 at 12:00 AM")
    end
  end

  describe '#human_readable_small', :type => :helper do
    it 'returns short human-readable datetime' do
      expect(human_readable_short(thedate)).to eq("Feb 15, 12:00 AM")
    end
  end
end
