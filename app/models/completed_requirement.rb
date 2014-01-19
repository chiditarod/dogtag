# Intermediate model between Registration and Requirement
# User indicates which user made the association
class CompletedRequirement < ActiveRecord::Base
  belongs_to :registration
  belongs_to :requirement
  belongs_to :user

  validates_presence_of :registration, :requirement, :user
  validates_uniqueness_of :registration, :scope => [:requirement], :allow_nil => true, :message => 'has already completed this requirement.'
  validates_uniqueness_of :requirement, :scope => [:registration], :allow_nil => true, :message => 'has already been completed for that registration'

  # default to returning a hash
  def metadata
    m = read_attribute :metadata
    return m if m.is_a?(Hash)
    return JSON.load m
  end
end