# Base model to be overridden by more specific requirements.
class Requirement < ActiveRecord::Base
  validates_presence_of :name

  belongs_to :race
  # todo: add database index for uniqueness
  validates_presence_of :race 
  has_many :completed_requirements
  has_many :registrations, :through => :completed_requirements

  ALLOWED_TYPES = [['Payment', 'PaymentRequirement']]

  class << self
    def allowed_types
      ALLOWED_TYPES
    end
  end

  def enabled?
    raise "Implement Me!"
  end

  def completed?(registration)
    CompletedRequirement.where(:registration_id => registration.id,
                               :requirement_id => id).present?
  end

  # todo: figure out how to alllow only child classes to call this method.
  def complete(registration_id, user)
    cr = CompletedRequirement.new :requirement_id => id,
      :registration_id => registration_id, :user => user
    return cr if cr.save
    false
  end
end
