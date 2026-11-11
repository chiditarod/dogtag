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

  include MoneyHelper, DateHelper

  CENTRAL_TIME = "Central Time (US & Canada)".freeze

  # Record delivery failures on the tracked sent_emails row, then re-raise so
  # job retries still happen.
  rescue_from StandardError do |e|
    MailTracking.delivery_failed(message, e)
    raise e
  end

  def welcome_email(user)
    @user = user
    track(kind: "welcome", user: user)
    mail(to: @user.email, subject: "Welcome to dogTag")
  end

  def team_finalized_email(user, team)
    track(kind: "team_finalized", team: team, user: user)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Registration Confirmed for #{team.name}")
  end

  def team_waitlisted_email(user, team)
    track(kind: "team_waitlisted", team: team, user: user)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Registration Waitlisted for #{team.name}")
  end

  def password_reset_instructions(user, host)
    track(kind: "password_reset", user: user)
    @edit_password_reset_url = edit_password_reset_url(user.perishable_token, host: host)
    mail(to: user.email, subject: 'dogTag Password Reset Instructions')
  end

  def classy_fundraising_team_created(user, team)
    track(kind: "classy_fundraising", team: team, user: user)
    set_vars_and_send(user, team, user.email, "#{team.race.name}: Fundraising is ready for #{team.name}")
  end

  # kind is one of tier_change, closing_week, closing_day. details carries
  # :dedupe_key plus, for tier_change, :new_price_cents and :begins_at.
  def registration_reminder(team, kind, details)
    @team = team
    @kind = kind
    @price = "$#{price_in_dollars_and_cents(details[:new_price_cents])}" if kind == "tier_change"
    @date = human_readable((details[:begins_at] || team.race.registration_close).in_time_zone(CENTRAL_TIME)).squish
    @missing = missing_items(team)
    @team_url = RegistrationUi.team_url(team)
    track(kind: "registration_reminder", team: team, user: team.user, dedupe_key: details.fetch(:dedupe_key))
    mail(to: team.user.email, subject: "#{team.race.name}: #{t(".subject_#{kind}", date: @date)}")
  end

  private

  def missing_items(team)
    race = team.race
    items = []
    items << t("user_mailer.registration_reminder.racers", count: team.people.size, total: race.people_per_team) if team.people.size < race.people_per_team
    items << t("user_mailer.registration_reminder.questions") unless team.completed_questions?
    items << t("user_mailer.registration_reminder.fee") unless team.completed_all_requirements?
    items
  end

  # Sets X-Dogtag-* headers read (and stripped) by MailTracking before delivery.
  def track(kind:, team: nil, user: nil, dedupe_key: nil)
    headers["X-Dogtag-Action"] = action_name
    headers["X-Dogtag-Kind"] = kind
    headers["X-Dogtag-User-Id"] = user&.id&.to_s
    headers["X-Dogtag-Team-Id"] = team&.id&.to_s
    headers["X-Dogtag-Race-Id"] = team&.race_id&.to_s
    headers["X-Dogtag-Dedupe-Key"] = dedupe_key
  end

  def set_vars_and_send(user, team, to, subject)
    @user = user
    @team = team
    mail(to: to, subject: subject)
  end
end
