# Base model to be overridden by more specific requirements.
class Requirement < ActiveRecord::Base
  validates_presence_of :name

  has_many :completed_requirements
  has_many :registrations, :through => :completed_requirements

  def fulfilled?(registration)
    CompletedRequirement.where(:registration_id => registration.id,
                               :requirement_id => id).present?
  end
end
