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

  describe "KINDS" do
    it "names every kind the mailers track" do
      tracked = Dir[Rails.root.join("app/mailers/*.rb")].flat_map { |file| File.read(file).scan(/track\(kind: "([a-z_]+)"/).flatten }
      expect(tracked).not_to be_empty
      expect(SentEmail::KINDS).to include(*tracked)
    end
  end

  describe "associations" do
    it "reads a deleted team as nil" do
      expect(SentEmail.new(team_id: 0).team).to be_nil
    end

    it "reads its team and user" do
      row = FactoryBot.create(:sent_email, team: team, user: team.user)
      expect(row.reload.team).to eq(team)
      expect(row.user).to eq(team.user)
    end
  end
end
