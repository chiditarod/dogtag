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
  class WelcomeEmail
    include Sidekiq::Worker
    include Workers::Common

    sidekiq_options queue: :default, retry: true, backtrace: true
    sidekiq_options failures: true

    def run(job, data={})
      %w(user_id).each do |key|
        job[key].present? || raise("Missing '#{key}' key in job hash")
      end

      user = User.find(job['user_id'])
      UserMailer.welcome_email(user).deliver_now
      log("complete")
    end
  end
end
