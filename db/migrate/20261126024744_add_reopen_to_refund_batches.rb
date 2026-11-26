# A refund batch can ask for every payment it refunds to be reopened as well (see Payments::ReopenPayment).
class AddReopenToRefundBatches < ActiveRecord::Migration[8.0]
  def change
    add_column :refund_batches, :reopen, :boolean
  end
end
