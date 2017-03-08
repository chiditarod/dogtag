# Intermediate model between a Team and Requirement
# User indicates which user made the association
class CompletedRequirement < ActiveRecord::Base
  belongs_to :team
  belongs_to :requirement
  belongs_to :user

  validates_presence_of :team, :requirement, :user
  validates_uniqueness_of :team, :scope => [:requirement], :allow_nil => true, :message => 'has already completed this requirement.'
  validates_uniqueness_of :requirement, :scope => [:team], :allow_nil => true, :message => 'has already been completed for that team'

  # todo: use postgres native json field type, here.
  serialize :metadata, JSON

  def metadata
    m = read_attribute :metadata
    return m if m.is_a?(Hash)
    return JSON.load(m)
  end

  # lookup a completed requirement by a stripe charge and delete it.
  def self.delete_by_charge(charge)

    req_id = charge['metadata']['requirement_id']

    # we used to have a registration table that linked a team (to be used more than once) to a race. we later
    # removed the registration table in favor of a single-use team object that registers for a single race.
    # We used to store the registration_id in stripe, and later changed to a team_id but kept support for
    # loading registration_id for older datasets.
    team_id = charge['metadata']['team_id'] || charge['metadata']['registration_id']

    # Introduce papertrail on completed requirement to track when the requirement is deleted
    # and by whom.  YES!
    cr = CompletedRequirement.where(requirement_id: req_id, team_id: team_id).first
    CompletedRequirement.destroy(cr)
  end
end
