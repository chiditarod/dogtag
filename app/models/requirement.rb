# Base model to be overridden by more specific requirements.
class Requirement < ActiveRecord::Base
  validates_presence_of :name

  belongs_to :race
  has_many :completed_requirements
  has_many :registrations, :through => :completed_requirements

  ALLOWED_TYPES = [['Payment', 'PaymentRequirement']]

  class << self
    def allowed_types
      ALLOWED_TYPES
    end
  end

  def completed?(registration)
    CompletedRequirement.where(:registration_id => registration.id,
                               :requirement_id => id).present?
  end

  # implementing classes should call #complete once valid
  def meets_criteria?
    raise 'Implement Me!'
  end

  # todo: figure out how to alllow only child classes to call this method.
  def complete(registration, user)
    return false unless self.meets_criteria?
    cr = CompletedRequirement.new :requirement_id => id,
      :registration_id => registration.id, :user => user
    cr.save
  end
end
