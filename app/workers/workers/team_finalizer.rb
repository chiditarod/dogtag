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
module Workers
  # Run post-finalization tasks
  class TeamFinalizer
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :important, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data={})
      job_email = Workers::TeamFinalizedEmail.perform_async({'team_id' => job['team_id']})
      job_classy = Workers::ClassyCreateFundraisingTeam.perform_async({'team_id' => job['team_id']})

      data[:child_job_ids] = {
        team_finalized_email: job_email,
        classy_create_fundraising_team: job_classy
      }
      log("complete", data)
    end
  end
end
