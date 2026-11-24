class CreateRefundBatches < ActiveRecord::Migration[8.0]
  def change
    create_table :refund_batches do |t|
      t.references :user, null: false, foreign_key: true
      t.references :retry_of, foreign_key: { to_table: :refund_batches, on_delete: :nullify }, null: true
      t.datetime :finished_at
      t.timestamps
    end

    create_table :refund_batch_items do |t|
      t.references :refund_batch, null: false, foreign_key: { on_delete: :cascade }
      t.references :completed_requirement, null: false, foreign_key: { on_delete: :cascade }
      t.text :status, null: false, default: "queued"
      t.text :error_code
      t.text :message
      t.datetime :finished_at
      t.timestamps
    end

    # Two tabs (or a double click) cannot queue the same payment twice.
    add_index :refund_batch_items, :completed_requirement_id, unique: true, where: "status = 'queued'",
      name: "index_refund_batch_items_one_queued_per_payment"
  end
end
