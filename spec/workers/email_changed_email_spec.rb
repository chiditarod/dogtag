# Copyright (C) 2017 Devin Breen
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

describe Workers::EmailChangedEmail do
  let(:worker) { Workers::EmailChangedEmail.new }

  describe "#run" do
    let!(:user) { FactoryBot.create :user }
    let(:job)   {{ 'user_id' => user.id, 'old_email' => 'before@example.com' }}

    it "mails the old address and logs 'complete'" do
      expect(worker).to receive(:log).with("received", {job: job})
      expect(worker).to receive(:log).with("complete")
      expect { worker.perform(job) }.to change { ActionMailer::Base.deliveries.count }.by(1)
      expect(ActionMailer::Base.deliveries.last.to).to eq(['before@example.com'])
    end
  end
end
