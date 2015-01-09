class UserMailer < ActionMailer::Base
  default from: "dogtag <dogtag@chiditarod.org>"

  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to dogTag")
  end

  def team_finalized_email(user, team)
    @user = user
    @team = team
    mail(to: @user.email, subject: "#{@team.race.name}: Registration Confirmed for #{team.name}")
  end

  def team_waitlisted_email(user, team)
    @user = user
    @team = team
    mail(to: @user.email, subject: "#{@team.race.name}: Registration Waitlisted for #{team.name}")
  end

  def password_reset_instructions(user, host)
    @edit_password_reset_url = edit_password_reset_url(user.perishable_token, host: host)
    mail(to: user.email, subject: 'dogTag Password Reset Instructions')
  end
end
