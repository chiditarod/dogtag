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
# Base model to be overridden by more specific requirements.
class Requirement < ApplicationRecord
  validates :name, presence: true

  belongs_to :race
  validates :race, presence: true
  validates :type, inclusion: { in: ->(_) { Requirement.allowed_types.map(&:last) } }, allow_nil: true

  has_many :completed_requirements
  has_many :teams, :through => :completed_requirements

  before_destroy :refuse_destroy_when_paid, prepend: true

  ALLOWED_TYPES = [['Payment', 'PaymentRequirement']]
  MOCK_TYPES = [["Mock payment", "MockPaymentRequirement"]]

  class << self
    # Mock payments are never offered or accepted in production.
    def allowed_types
      Rails.env.production? ? ALLOWED_TYPES : ALLOWED_TYPES + MOCK_TYPES
    end
  end

  # A fee is never deletable once anyone paid it, refunded or not: the payment history hangs off it.
  def payments?
    completed_requirements.exists?
  end

  def paid_team_count
    completed_requirements.where(refunded_at: nil).count
  end

  def destroy_blocked_reason
    return unless payments?

    count = paid_team_count
    return "Can't delete: it has refunded payments." if count.zero?

    "Can't delete: #{count} #{count == 1 ? "team has" : "teams have"} paid it."
  end

  def enabled?
    raise "Implement Me!"
  end

  def cr_for(team)
    record = CompletedRequirement.where(:team_id => team.id, :requirement_id => id).first
    record.presence
  end

  def completed?(team)
    CompletedRequirement.where(:team_id => team.id, :requirement_id => id).present?
  end

  # todo: figure out how to allow only child classes to call this method.
  # todo: move JSON and is_a? Hash calls into the model
  def complete(team_id, user, metadata = {})
    attributes = {
      :requirement_id => id,
      :team_id => team_id,
      :user => user,
      :metadata => JSON.generate(metadata)
    }
    # Deploy window: from the push until AddPaymentColumnsToCompletedRequirements has run, these columns do
    # not exist and assigning them raises UnknownAttributeError after the card was charged. The metadata
    # still carries both, and the migration's backfill copies them into the columns.
    if CompletedRequirement.column_names.include?("charge_id")
      attributes.merge!(:charge_id => metadata["charge_id"], :amount_cents => metadata["amount"])
    end
    cr = CompletedRequirement.new(attributes)
    cr.subscribe(CompletedRequirementAuditor.new)
    return cr if cr.save
    false
  end

  private

  def refuse_destroy_when_paid
    reason = destroy_blocked_reason
    return unless reason

    errors.add(:base, reason)
    throw :abort
  end
end
