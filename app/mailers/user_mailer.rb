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
  # Where racer questions and feedback go; also shown in the site footer. ENV["FEEDBACK_EMAIL"] overrides it for feedback.
  STAFF_EMAIL = "registration@chiditarod.org".freeze

  default from: "dogtag <dogtag@chiditarod.org>"

  helper MoneyHelper, DateHelper

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

  # Sent to the team's account holder when one of its payments is refunded. `details` are plain values
  # (:completed_requirement_id, :charge_id, :requirement_name, :amount_cents, :race_name) rather than the completed
  # requirement, because an admin may delete that row after refunding.
  def payment_refunded_email(user, team, details)
    @team = team
    @requirement_name = details[:requirement_name]
    @race_name = details[:race_name]
    @amount = ActiveSupport::NumberHelper.number_to_currency(details[:amount_cents] / 100.0) if details[:amount_cents]
    track(kind: "refund", team: team, user: user, dedupe_key: "refund-#{details.fetch(:charge_id)}")
    mail(to: user.email, subject: t(".subject", race: @race_name, team: team.name))
  end

  # Sent to the address an account used to have, so its owner hears about a change they did not make.
  def email_changed_email(user, old_email)
    @user = user
    @old_email = old_email
    track(kind: "email_changed", user: user)
    mail(to: old_email, subject: t(".subject"))
  end

  def password_reset_instructions(user, host)
    track(kind: "password_reset", user: user)
    @edit_password_reset_url = RegistrationUi.password_reset_url(user.perishable_token, host: host)
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
    @price = "$#{view_context.price_in_dollars_and_cents(details[:new_price_cents])}" if kind == "tier_change"
    @date = reminder_date(team.race, details[:begins_at])
    @missing = missing_items(team)
    @team_url = RegistrationUi.team_url(team)
    track(kind: "registration_reminder", team: team, user: team.user, dedupe_key: details.fetch(:dedupe_key))
    mail(to: team.user.email, subject: "#{team.race.name}: #{t(".subject_#{kind}", date: @date)}")
  end

  # Sent to staff. `context` is what the SPA knew when the racer wrote in:
  # :path, :team_id, :user_agent. `user` is nil for visitors who are logged out.
  # `team` is set only when the sender may see that team; a team_id without one
  # is an unverified claim and is shown as such and not tracked.
  def feedback_email(user, message, context, team = nil)
    @user = user
    @message = message
    @context = context
    @team = team
    track(kind: "feedback", team: team, user: user)
    mail(
      to: ENV["FEEDBACK_EMAIL"].presence || STAFF_EMAIL,
      reply_to: user&.email,
      subject: "dogTag feedback#{" from #{user.email}" if user}"
    )
  end

  private

  # A tier change shows when the new price begins; otherwise the reminder is
  # about the registration deadline.
  def reminder_date(race, begins_at)
    return view_context.human_readable(race.local(begins_at)) if begins_at

    view_context.deadline_readable(race.local(race.registration_close))
  end

  def missing_items(team)
    race = team.race
    items = []
    items << t("user_mailer.registration_reminder.racers", count: team.people.size, total: race.people_per_team) if team.people.size < race.people_per_team
    items << t("user_mailer.registration_reminder.captain") if team.people.any? && team.captain_id.blank?
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
