require "spec_helper"

describe SentEmail do
  let(:team) { FactoryBot.create(:team) }

  it "defaults to queued status" do
    expect(SentEmail.create!(recipient: "a@example.com").status).to eq("queued")
  end

  it "rejects a duplicate dedupe_key for the same team and kind" do
    attrs = { team_id: team.id, kind: "reminder", dedupe_key: "k1", recipient: "a@example.com" }
    SentEmail.create!(attrs)
    expect { SentEmail.create!(attrs) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "allows many rows without a dedupe_key" do
    attrs = { team_id: team.id, kind: "welcome", recipient: "a@example.com" }
    expect { 2.times { SentEmail.create!(attrs) } }.not_to raise_error
  end

  describe "#delivered?" do
    it "is true only when status is delivered" do
      expect(SentEmail.new(status: "delivered")).to be_delivered
      expect(SentEmail.new(status: "sent")).not_to be_delivered
    end
  end
end
