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
class UserMailer < ActionMailer::Base
  default from: "dogtag <dogtag@chiditarod.org>"

  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to dogTag")
  end

  def team_finalized_email(user, team)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Registration Confirmed for #{team.name}")
  end

  def team_waitlisted_email(user, team)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Registration Waitlisted for #{team.name}")
  end

  def password_reset_instructions(user, host)
    @edit_password_reset_url = edit_password_reset_url(user.perishable_token, host: host)
    mail(to: user.email, subject: 'dogTag Password Reset Instructions')
  end

  def classy_is_ready(user, team)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Fundraising is ready for #{team.name}")
  end

  private

  def set_vars_and_send(user, team, to, subject)
    @user = user
    @team = team
    mail(to: to, subject: subject)
  end
end
