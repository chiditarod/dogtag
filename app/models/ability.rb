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

    # a user can update their own information
    can [:show, :update], User, :id => user.id

    can :read, Race
    can :create, Team
    #can [:show, :update], Team, 

    if user.is? :operator
      can [:read, :update], User

      can [:read, :create, :update], [Race, Requirement, Tier]
      can [:update], [Person]
      can [:read], [Registration, Team]
    end

    #if user.is? :refunder
      #can :refund, Charge
    #end
  end
end
