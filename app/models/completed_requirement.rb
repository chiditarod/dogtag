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
# Intermediate model between a Team and Requirement
# User indicates which user made the association
class CompletedRequirement < ApplicationRecord

  include Wisper.model

  belongs_to :team
  belongs_to :requirement
  belongs_to :user
  belongs_to :refunded_by, class_name: "User", optional: true

  validates :team, :requirement, :user, presence: true
  validates :team, uniqueness: { :scope => [:requirement], :allow_nil => true, :message => 'has already completed this requirement.' }
  validates :requirement, uniqueness: { :scope => [:team], :allow_nil => true, :message => 'has already been completed for that team' }

  # todo: use postgres native json field type, here.
  serialize :metadata, coder: JSON

  def metadata
    m = read_attribute :metadata
    # Older rows were JSON-encoded two or more extra times, so unwrap until it is no longer a String.
    m = JSON.load(m) while m.is_a?(String)
    m
  end

  has_many :refund_batch_items, dependent: :destroy

  # Both fall back to the metadata on a row loaded without the payment columns (a dyno running before
  # AddPaymentColumnsToCompletedRequirements has run), so the legacy team page and TeamChecklist still work.
  def refunded?
    return refunded_at.present? if has_attribute?(:refunded_at)

    legacy_metadata["refunded"].present?
  end

  def charge_id
    has_attribute?(:charge_id) ? super : legacy_metadata["charge_id"]
  end

  # The one definition of a payment's status: refunded, refunding (a refund batch item is queued),
  # not_refundable (no Stripe charge, or a mock payment in production) or paid. Needs `requirements`
  # joined, so scope with joins(:requirement). Nothing else re-derives it.
  def self.payment_status_sql
    mock_in_production = Rails.env.production? ? "requirements.type = 'MockPaymentRequirement'" : "FALSE"
    <<~SQL.squish
      CASE
        WHEN completed_requirements.refunded_at IS NOT NULL THEN 'refunded'
        WHEN EXISTS (
          SELECT 1 FROM refund_batch_items
          WHERE refund_batch_items.completed_requirement_id = completed_requirements.id
            AND refund_batch_items.status = 'queued'
        ) THEN 'refunding'
        WHEN completed_requirements.charge_id IS NULL OR #{mock_in_production} THEN 'not_refundable'
        ELSE 'paid'
      END
    SQL
  end

  scope :with_payment_status, ->(status) { where("#{payment_status_sql} = ?", status.to_s) }

  # Rows loaded with `select(..., "#{payment_status_sql} AS payment_status")` already carry it; any other row
  # asks the database, so a loaded status can be stale after the row changes (reload it).
  def payment_status
    return self[:payment_status] if has_attribute?(:payment_status)

    self.class.unscoped.joins(:requirement).where(id: id).pick(Arel.sql(self.class.payment_status_sql))
  end

  def refundable? = payment_status == "paid"

  private

  def legacy_metadata
    data = metadata
    data.is_a?(Hash) ? data : {}
  end
end
