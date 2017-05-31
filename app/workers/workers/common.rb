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
require 'sidekiq/api'

module Workers
  module Common

    def perform(original_job)
      original_job = {} if original_job.nil?
      job = Marshal.load(Marshal.dump(original_job))

      log = {
        job: job
      }
      log("received", log)
      run(job, log)

    rescue StandardError, EOFError, SystemCallError, SocketError => ex
      log("error", {}, :error, ex)
      raise ex
    end

    def run
      raise "implement where you include Workers::Common!"
    end

    def log(event, data={}, level=:info, exception=nil)
      log = {
        event: event,
        worker: self.class.to_s,
        jid: self.jid,
        data: data
      }
      if exception.present?
        log[:exception] = {
          klass: exception.class,
          message: exception.message,
          backtrace: exception.backtrace
        }
      end
      Rails.logger.send(level, log)
    end
  end
end
