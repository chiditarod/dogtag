class UserMailer < ActionMailer::Base
  default from: "dogtag <dogtag@chiditarod.org>"

  #add_template_helper(ReasonHelper)
  #add_template_helper(MessageHelper)

  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: "Welcome to dogtag")
  end

  def registration_finalized_email(user, reg)
    @user = user
    @reg = reg
    mail(to: @user.email, subject: "#{@reg.race.name}: Registration Confirmed for #{reg.name}")
  end
end
