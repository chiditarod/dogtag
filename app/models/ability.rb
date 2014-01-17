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

    #can :read, Project, :active => true, :user_id => user.id
    #can :manage, Project, :group => { :id => user.group_ids }
    #can :read, Project, :active => true, :user_id => user.id

    # guest-only stuff
    unless user.id
      # only show user creation form to guest users
      can [:create], User
    end

    # User can create and manage themself
    can [:show, :update], User, :id => user.id

    # Team
    can [:create], Team
    can [:read, :update], Team, :user_id => user.id

    # Races:
    can [:read], Race

    # Registrations
    can [:index], Registration
    can [:create], Registration
    can [:read, :update], Registration, :team => { :id => user.team_ids }

    # People
    can [:create], Person
    can [:show, :update], Person do |person|
      user.team_ids.include? person.registration.team.id
    end

    # Requirement: no user-level access required
    # Tier: no user-level access required

    if user.is? :operator
      can [:read, :update], [Registration, Team]
      can [:read, :create, :update], [Race, PaymentRequirement, Tier]
    end

  end
end
