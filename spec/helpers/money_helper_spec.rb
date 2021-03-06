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
require 'spec_helper'

describe MoneyHelper do

  describe '#price_in_dollars_and_cents' do
    it 'returns an integer of cents as a string of dollars and cents' do
      expect(price_in_dollars_and_cents(10000)).to eq('100.00')
    end

    it 'returns 0.00 when cents is nil' do
      expect(price_in_dollars_and_cents(nil)).to eq('0.00')
    end

    it 'returns 0.00 when cents is 0' do
      expect(price_in_dollars_and_cents(0)).to eq('0.00')
    end
  end
end
