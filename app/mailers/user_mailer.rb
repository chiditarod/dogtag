class UserMailer < ActionMailer::Base
  default from: "dogtag <dogtag@chiditarod.org>"

  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to dogtag")
  end

  def team_finalized_email(user, team)
    @user = user
    @team = team
    mail(to: @user.email, subject: "#{@team.race.name}: Registration Confirmed for #{team.name}")
  end

  def team_waitlisted_email(user, team)
    @user = user
    @team = team
    mail(to: @user.email, subject: "#{@team.race.name}: Registration Waitlist for #{team.name}")
  end
end
