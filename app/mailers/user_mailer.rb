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

  private

  def set_vars_and_send(user, team, to, subject)
    @user = user
    @team = team
    mail(to: to, subject: subject)
  end
end
