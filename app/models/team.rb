# Copyright (C) 2013 Devin Breen
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
class Team < ApplicationRecord
  OTHER_BUDDIES_MAX_LENGTH = 1000
  CAPTAIN_KEYS = %w(first_name last_name email phone).freeze

  validates :name, :description, presence: true
  validates :name, length: { :maximum => 1000, :message => "of your team is a bit long, eh? Keep it to 1000 characters or less." }
  validates :name, uniqueness: { :scope => [:race], :message => 'should be unique per race' }
  validates :experience, presence: true
  validates :experience, :numericality => { :only_integer => true, :greater_than_or_equal_to => 0 }
  validates :other_buddies, length: { maximum: OTHER_BUDDIES_MAX_LENGTH }
  validates_with TeamValidator

  include Wisper.model

  belongs_to :user
  belongs_to :race
  validates :user, :race, presence: true

  # The racer organizers contact directly. Not the same as `user`, the account that created the team.
  belongs_to :captain, class_name: "Person", optional: true
  validate :captain_must_be_on_team, if: :will_save_change_to_captain_id?

  # A team has a certain number of people, per the settings for the race.
  has_many :people, dependent: :destroy

  # A team must track which race requirements have been fulfilled.
  # Only payments that still count; a reopened payment stays in all_completed_requirements as history.
  has_many :completed_requirements, -> { active }
  has_many :all_completed_requirements, class_name: "CompletedRequirement", dependent: nil
  has_many :requirements, :through => :completed_requirements

  # Teams this team asked to start near, and the picks other teams made of this one.
  has_many :team_buddies, dependent: :destroy
  has_many :buddy_teams, through: :team_buddies
  has_many :named_by_buddies, class_name: "TeamBuddy", foreign_key: :buddy_team_id, dependent: :destroy

  before_validation :normalize_other_buddies

  scope :all_finalized,   -> { where('teams.finalized = ?', true) }
  scope :all_unfinalized, -> { where('teams.finalized IS NULL') }
  scope :belonging_to, ->(user_id) { where("user_id = ?", user_id) }

  # Library filing order, so "The Secret Gentlemen" sorts under S: "Secret Gentlemen, The".
  def library_name
    name.to_s.sub(/\A[[:space:]]*(?<the>the)[[:space:]]+(?<rest>[^[:space:]].*?)[[:space:]]*\z/i) { "#{$~[:rest]}, #{$~[:the]}" }
  end

  # A team that never finished registering: nothing paid (not even a refunded or reopened payment, which
  # stays as history) and not finalized. Only these can be deleted by their captain or by operators.
  def deletable?
    !finalized && all_completed_requirements.none?
  end

  def unfinalized
    ! finalized
  end

  # sets the finalization bits and triggers follow-up actions
  # return nil if the team is not a candidate for finalization
  def finalize
    return nil if finalized
    return nil unless ready_to_finalize?

    self.notified_at = Time.zone.now
    self.assigned_team_number = self.assigned_team_number || next_available_team_num
    self.finalized = true

    if self.save
      Workers::TeamFinalizer.perform_async({'team_id' => self.id})
      Rails.logger.info "Finalized Team: #{name} (id: #{id})"
      true
    else
      msg = "Failed to finalize team: #{name}"
      Rails.logger.error(msg)
      raise StandardError, msg
    end
  end

  # this removes the finalization bits from the team
  # return nil if the team is not a candidate for unfinalization
  def unfinalize(force=false)
    if ! force
      return nil unless finalized
      return nil if meets_finalization_requirements?
    end

    self.notified_at = nil
    self.finalized = nil
    self.save
  end

  # Total years racing across the roster. A blank experience counts as 0.
  def person_experience
    people.sum { |person| person.experience.to_i }
  end

  # A team is new when its racers' years racing add up to 0 (a blank counts as 0).
  # nil until the team has racers. An admin override is left alone; it is checked in
  # SQL so a stale copy of the team cannot overwrite it.
  def refresh_new_team
    Team.where(id: id, new_team_overridden: [nil, false]).update_all(new_team: computed_new_team)
  end

  # The flag the roster gives, ignoring any override.
  def computed_new_team
    return nil unless persisted? && people.exists?
    people.sum("COALESCE(experience, 0)").zero?
  end

  def new_team_setting
    return "auto" unless new_team_overridden
    new_team ? "yes" : "no"
  end

  def new_team_setting=(value)
    case value.to_s
    when "yes", "no"
      self.new_team_overridden = true
      self.new_team = value.to_s == "yes"
    when "auto"
      self.new_team_overridden = nil
      self.new_team = computed_new_team
    end
  end

  def percent_complete
    total = race.requirements.select(&:enabled?).size + race.people_per_team
    total += 1 if race.jsonform.present?

    var = people.size + requirements.size
    var += 1 if jsonform.present?
    (var * 100) / total
  end

  def needs_people?
    (race.people_per_team - people.count) > 0
  end

  def is_full?
    ! needs_people?
  end

  # Net of refunds: a refunded payment counts as 0 (CompletedRequirement#net_paid_cents).
  def money_paid_in_cents
    completed_requirements.sum(&:net_paid_cents)
  end

  def completed_questions?
    jsonform.present? || race.jsonform.blank?
  end

  def jsonform_value(key)
    return nil if jsonform.nil?
    @jsonform_hash ||= JSON.parse(jsonform)
    @jsonform_hash[key]
  end

  def completed_all_requirements?
    return true if race.requirements.blank?
    race.requirements.select(&:enabled?).map(&:id).sort == requirements.map(&:id).sort
  end

  def meets_finalization_requirements?
    completed_questions? && is_full? && completed_all_requirements?
  end

  # Finalization also needs a captain. It is kept out of meets_finalization_requirements? on
  # purpose: unfinalize checks that, so adding it would un-finalize every finalized team that
  # has no captain on its next edit.
  def ready_to_finalize?
    meets_finalization_requirements? && captain_id.present?
  end

  # todo spec
  def has_saved_answers?
    jsonform.present?
  end

  def classy_fundraising_url
    return if classy_id.blank?

    "https://www.classy.org/team/#{classy_id}?campaignId=#{race.classy_campaign_id}"
  end

  def waitlist_position
    # assume we are not on the waitlist if race is not full
    return false if race.not_full?
    # assume we are not on the waitlist if our requirements are met
    return false if finalized

    # find all unfinalized teams for this race, ordered by created_at
    waitlisted_teams = Team.all_unfinalized
                           .where(race_id: race_id)
                           .order(:created_at)
                           .pluck(:id)

    waitlisted_teams.index(id) + 1
  end

  # Names of the teams this team picked (as stored, alphabetical like the picker),
  # then the free-text other_buddies when present.
  def racing_with_names
    picked = buddy_teams.sort_by { |t| [t.name.to_s.downcase, t.id] }.map(&:name)
    picked << other_buddies if other_buddies.present?
    picked
  end

  private

  def captain_must_be_on_team
    errors.add(:captain, :not_on_team) if captain_id.present? && captain&.team_id != id
  end

  def normalize_other_buddies
    self.other_buddies = other_buddies.to_s.strip.presence
  end

  def next_available_team_num
    teams = Team.where(race_id: race.id).where('teams.assigned_team_number IS NOT NULL')
    used_numbers = teams.map(&:assigned_team_number).compact

    (1..Race::MAX_TEAMS_PER_RACE).detect do |n|
      ! used_numbers.include?(n)
    end
  end


  class << self
    def export(race_id, options = {})
      race = Race.find(race_id)
      person_keys = %w(first_name last_name email phone instagram experience tiktok)
      user_keys = %w(first_name last_name email phone stripe_customer_id)

      table = []
      table << make_header(race, person_keys, user_keys)
      table.concat(make_body(race, options, person_keys, user_keys))
    end

    private

    # Spreadsheet apps evaluate cells that start with these characters as formulas.
    def spreadsheet_safe(value)
      value.start_with?("=", "+", "-", "@") ? "'#{value}" : value
    end

    def racing_with_cell(team)
      team.racing_with_names.map { |name| spreadsheet_safe(name) }.join("; ")
    end

    def make_body(race, options, person_keys, user_keys)
      teams = options[:finalized] ? race.finalized_teams : race.teams
      teams = teams.preload(:buddy_teams, :captain)
      teams.inject([]) do |memo, team|
        row = []
        row << team.finalized.to_s
        row << team.assigned_team_number.to_s

        cols = [].concat(Team.attribute_names.select do |n|
          %w(name experience description).include?(n)
        end)

        # team basics (the name uses library rules so "The" teams don't all file under T)
        row.concat(cols.map { |n|
          case n
          when "experience" then race.experience_label(team[n])
          when "name" then spreadsheet_safe(team.library_name)
          else team[n]
          end
        })

        # race-specific details
        row.concat race.question_fields.map{ |n| team.jsonform_value(n) }

        # user info
        row.concat user_keys.map{ |k| team.user[k] }

        # captain (the racer organizers contact); inferred means we guessed during the backfill
        row.concat CAPTAIN_KEYS.map { |k| team.captain ? spreadsheet_safe(team.captain[k].to_s) : "" }
        row << (team.captain_inferred ? "yes" : "")

        # racers
        race.people_per_team.times do |i|
          person = team.people[i]
          row.concat person_keys.map { |k|
            person.blank? ? "" : person[k]
          }
        end

        # Newer columns go after the racers so the older columns keep their
        # positions. `collaborating` sits just before `racing_with`, which
        # moved `racing_with` one column to the right (#332).
        row << { true => "yes", false => "no" }.fetch(team.new_team, "")

        row << { true => "Yes", false => "No" }.fetch(team.collaborating, "")
        row << racing_with_cell(team)

        memo << row
      end
    end

    def make_header(race, person_keys, user_keys)
      header = []
      header << 'finalized'
      header << 'number'

      # team basics
      header.concat(Team.attribute_names.select do |n|
        %w(name experience description).include?(n)
      end)

      # race-specific details
      header.concat race.question_fields.map{ |n| n.humanize }

      # user info
      header.concat user_keys.map{ |k| "user_#{k}" }

      # captain
      header.concat CAPTAIN_KEYS.map { |k| "captain_#{k}" }
      header << 'captain_inferred'

      # racers
      race.people_per_team.times do |i|
        header.concat person_keys.map{ |k| "dawg_#{i}_#{k}" }
      end

      header << 'new_team'
      header << 'collaborating'
      header << 'racing_with'
    end
  end
end
