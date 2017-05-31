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

describe Workers::TeamFinalizer do

  let(:worker)  { Workers::TeamFinalizer.new }

  describe "#run" do
    let(:team_id) { 1 }
    let(:job)  {{ 'team_id' => team_id }}
    let(:data) {{
      job: job,
      child_job_ids: {
        team_finalized_email: "foo",
        classy_create_fundraising_team: "bar"
      }
    }}

    it "calls other workers and logs their job ids" do
      expect(worker).to receive(:log).with("received", {job: job})
      expect(Workers::TeamFinalizedEmail).to receive(:perform_async).with({team_id: team_id}).and_return("foo")
      expect(Workers::ClassyCreateFundraisingTeam).to receive(:perform_async).with({team_id: team_id}).and_return("bar")
      expect(worker).to receive(:log).with("complete", data)
      worker.perform(job)
    end
  end
end
