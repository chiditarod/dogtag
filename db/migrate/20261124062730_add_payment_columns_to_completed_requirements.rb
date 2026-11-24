class AddPaymentColumnsToCompletedRequirements < ActiveRecord::Migration[8.0]
  def change
    add_column :completed_requirements, :charge_id, :text
    add_column :completed_requirements, :amount_cents, :integer
    add_column :completed_requirements, :refunded_at, :datetime
    add_column :completed_requirements, :stripe_refund_id, :text
    add_reference :completed_requirements, :refunded_by, foreign_key: { to_table: :users, on_delete: :nullify }, null: true
    add_index :completed_requirements, :charge_id

    reversible { |direction| direction.up { backfill_payment_columns } }
  end

  # Public so the spec can run it against factory data. Reads each row through
  # CompletedRequirement#metadata, which unwraps the double and triple JSON encoding of old rows.
  def backfill_payment_columns
    CompletedRequirement.reset_column_information
    CompletedRequirement.find_each do |cr|
      metadata = cr.metadata
      unless metadata.is_a?(Hash)
        Rails.logger.warn("Skipping completed requirement #{cr.id}: metadata is not a hash")
        next
      end

      attrs = { charge_id: metadata["charge_id"], amount_cents: Integer(metadata["amount"].to_s, exception: false) }
      attrs[:refunded_at] = cr.updated_at || cr.created_at || Time.current if metadata["refunded"] && cr.refunded_at.nil?
      cr.update_columns(attrs)
    rescue JSON::ParserError, TypeError => e
      Rails.logger.warn("Skipping completed requirement #{cr.id}: metadata cannot be decoded (#{e.class})")
    end
  end
end
