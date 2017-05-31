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

describe FlashHelper do

  describe '#flash_to_bootstrap', :type => :helper do
    it 'returns correct bootstrap 3 alert messages' do
      expect(flash_to_bootstrap(:info)).to eq('success')
      expect(flash_to_bootstrap(:notice)).to eq('info')
      expect(flash_to_bootstrap(:error)).to eq('danger')
      expect(flash_to_bootstrap(:alert)).to eq('warning')
    end
  end
end
