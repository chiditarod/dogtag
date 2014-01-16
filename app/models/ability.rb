class Ability
  include CanCan::Ability

  # See the wiki for details:
  # https://github.com/ryanb/cancan/wiki/Defining-Abilities
  def initialize(user)

    alias_action :index, :show, :to => :read
    alias_action :new, :to => :create
    alias_action :edit, :to => :update
    alias_action :create, :read, :update, :destroy, :to => :crud

    user ||= User.new

    can :create, User
    can :read, Race
    can :update, User, :id => user.id

    if user.is? :admin
      can :manage, :all
    end
    if user.id
    end
    if user.is? :refunder

    end
    if user.is? :operator
      #can :read, Project, :active => true, :user_id => user.id
      #can :manage, Project, :group => { :id => user.group_ids }
      #can :read, Project, :active => true, :user_id => user.id
    end

  end
end
