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
class Ability
  include CanCan::Ability

  # See the wiki for details:
  # https://github.com/CanCanCommunity/cancancan/wiki/Defining-Abilities
  def initialize(user)

    alias_action :new, :to => :create
    alias_action :index, :show, :to => :read
    alias_action :edit, :to => :update
    alias_action :create, :read, :update, :destroy, :to => :crud

    user ||= User.new

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
    can [:create], :charges

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

    if user.is? :refunder
      can [:index], User
      can [:read], Team
      can [:refund], :charges
    end

    if user.is? :operator
      can [:export], Race
      can [:read, :update], [Team, Person]
      can [:read, :create, :update], [Race, PaymentRequirement, Tier]
      can [:refund], :charges
    end

    if user.is? :admin
      can :manage, :all
    end
  end
end
