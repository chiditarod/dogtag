require "spec_helper"
require Rails.root.join("db/migrate/20261124062730_add_payment_columns_to_completed_requirements")

describe AddPaymentColumnsToCompletedRequirements do
  def build_cr(raw_metadata)
    cr = FactoryBot.create(:completed_requirement)
    cr.update_columns(metadata: raw_metadata, charge_id: nil, amount_cents: nil, refunded_at: nil)
    cr
  end

  def backfill
    migration = described_class.new
    migration.suppress_messages { migration.backfill_payment_columns }
    CompletedRequirement.reset_column_information
  end

  let(:hash) { { "charge_id" => "ch_1", "customer_id" => "cus_1", "amount" => 5000 } }

  it "copies charge_id and amount from double-encoded metadata" do
    cr = build_cr(JSON.generate(JSON.generate(hash)))

    backfill

    expect(cr.reload.charge_id).to eq("ch_1")
    expect(cr.amount_cents).to eq(5000)
  end

  it "copies them from triple-encoded metadata" do
    cr = build_cr(JSON.generate(JSON.generate(JSON.generate(hash))))

    backfill

    expect(cr.reload.charge_id).to eq("ch_1")
    expect(cr.amount_cents).to eq(5000)
  end

  it "sets refunded_at to updated_at and leaves refunded_by nil for legacy refunded rows" do
    cr = build_cr(JSON.generate(JSON.generate(hash.merge("refunded" => true))))
    stamp = Time.utc(2026, 11, 20, 15, 0, 0)
    cr.update_columns(updated_at: stamp)

    backfill

    expect(cr.reload.refunded_at).to eq(stamp)
    expect(cr.refunded_by_id).to be_nil
  end

  it "leaves refunded_at blank for rows that were never refunded" do
    cr = build_cr(JSON.generate(JSON.generate(hash)))

    backfill

    expect(cr.reload.refunded_at).to be_nil
  end

  it "skips a row whose metadata cannot be decoded" do
    bad = build_cr("{not json")
    good = build_cr(JSON.generate(JSON.generate(hash)))

    expect { backfill }.not_to raise_error

    expect(bad.reload.charge_id).to be_nil
    expect(bad.amount_cents).to be_nil
    expect(good.reload.charge_id).to eq("ch_1")
  end

  it "stores a nil amount_cents when the amount is not a whole number" do
    cr = build_cr(JSON.generate(JSON.generate("charge_id" => "ch_2", "amount" => "abc")))

    backfill

    expect(cr.reload.charge_id).to eq("ch_2")
    expect(cr.amount_cents).to be_nil
  end

  it "sends no email" do
    build_cr(JSON.generate(JSON.generate(hash.merge("refunded" => true))))

    expect { backfill }.not_to change { ActionMailer::Base.deliveries.count }
    expect(Workers::PaymentRefundedEmail.jobs).to be_empty
  end

  it "is idempotent" do
    cr = build_cr(JSON.generate(JSON.generate(hash.merge("refunded" => true))))

    backfill
    first = cr.reload.refunded_at
    backfill

    expect(cr.reload.refunded_at).to eq(first)
    expect(cr.charge_id).to eq("ch_1")
  end
end
