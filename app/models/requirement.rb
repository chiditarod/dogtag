# Base model to be overridden by more specific requirements.
class Requirement < ActiveRecord::Base
  validates_presence_of :name

  has_many :registrations, :as => :fulfilled_registrations,
    :through => :registration_requirements

  def fulfilled?(registration)
    RegistrationRequirement.where(:registration_id => registration.id,
                                  :requirement_id => id).present?
  end
end
