require "spec_helper"

describe RefundBatch do
  describe ".max_size" do
    def with_limit(value)
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("REFUND_BATCH_LIMIT").and_return(value)
    end

    it "is 5 when REFUND_BATCH_LIMIT is unset" do
      with_limit(nil)
      expect(described_class.max_size).to eq(5)
    end

    it "is 10 when it is \"10\"" do
      with_limit("10")
      expect(described_class.max_size).to eq(10)
    end

    it "is 5 for \"0\", \"-3\", \"ten\" and \"\"" do
      ["0", "-3", "ten", ""].each do |junk|
        with_limit(junk)
        expect(described_class.max_size).to eq(5), "expected 5 for #{junk.inspect}"
      end
    end
  end

  describe "#mark_stalled!" do
    it "marks queued items stalled only after 10 minutes" do
      start = Time.utc(2026, 11, 24, 12, 0, 0)
      batch = Timecop.freeze(start) { FactoryBot.create(:refund_batch) }
      queued = FactoryBot.create(:refund_batch_item, refund_batch: batch)
      done = FactoryBot.create(:refund_batch_item, refund_batch: batch, status: "refunded")

      Timecop.freeze(start + 9.minutes) { batch.mark_stalled! }
      expect(queued.reload.status).to eq("queued")

      Timecop.freeze(start + 11.minutes) { batch.mark_stalled! }
      expect(queued.reload.status).to eq("stalled")
      expect(queued.finished_at).to eq(start + 11.minutes)
      expect(done.reload.status).to eq("refunded")
    end
  end

  describe "#finished?" do
    it "is true once finished_at is set" do
      batch = FactoryBot.create(:refund_batch)
      expect(batch).not_to be_finished
      batch.update!(finished_at: Time.current)
      expect(batch).to be_finished
    end
  end
end
