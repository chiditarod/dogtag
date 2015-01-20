class Ability
  include CanCan::Ability

  # See the wiki for details:
  # https://github.com/ryanb/cancan/wiki/Defining-Abilities
  def initialize(user)

    alias_action :new, :to => :create
    alias_action :index, :show, :to => :read
    alias_action :edit, :to => :update
    alias_action :create, :read, :update, :destroy, :to => :crud

    user ||= User.new

    if user.is? :admin
      can :manage, :all
    end

    # guest-only stuff
    unless user.id
      # only show user creation form to guest users
      can [:create], User
    end

    # User can create and manage themself
    can [:show, :update], User, :id => user.id

    # Team
    can [:index, :create], Team
    can [:read], Team, user_id: user.id
    can [:update], Team do |team|
      team.user_id == user.id && team.race.open_for_registration?
    end

    # Questions
    can [:show, :create], :questions

    # Stripe charges
    can [:create, :refund], :charges

    #todo implement at some point
    #can [:destroy], Team do |team|
      #user.id == team.user_id && team.completed_requirements.empty?
    #end

    # Races
    # /races/
    # /races/:race_id/registrations
    can [:read, :registrations], Race

    # People
    can [:create], Person
    can [:show, :update], Person do |person|
      user.team_ids.include?(person.team.id) && person.team.race.open_for_registration?
    end

    # Requirement
    # no user-level access required

    # Tier
    # no user-level access required

    if user.is? :operator
      can [:export], Race
      can [:read, :update], Team
      can [:read, :update], Person
      can [:read, :create, :update], [Race, PaymentRequirement, Tier]
    end
  end
end
