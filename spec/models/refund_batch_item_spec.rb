require "spec_helper"

describe RefundBatchItem do
  let(:cr) { FactoryBot.create(:completed_requirement, charge_id: "ch_1") }

  it "cannot queue the same completed requirement twice" do
    FactoryBot.create(:refund_batch_item, completed_requirement: cr)

    expect {
      FactoryBot.create(:refund_batch_item, completed_requirement: cr, status: "queued")
    }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "allows a new queued item once the old one is stalled" do
    FactoryBot.create(:refund_batch_item, completed_requirement: cr, status: "stalled")

    expect {
      FactoryBot.create(:refund_batch_item, completed_requirement: cr, status: "queued")
    }.not_to raise_error
  end

  it "rejects an unknown status" do
    item = FactoryBot.build(:refund_batch_item, status: "bogus")
    expect(item).not_to be_valid
  end
end
