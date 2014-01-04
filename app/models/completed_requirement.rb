# Intermediate model between Registration and Requirement
# User indicates which user made the association
class CompletedRequirement < ActiveRecord::Base
  belongs_to :registration
  belongs_to :requirement
  belongs_to :user
end
