require "spec_helper"

describe RaceExport do
  let(:race) { FactoryBot.create(:race) }

  before do
    FactoryBot.create(:finalized_team, race: race)
    FactoryBot.create(:team, race: race)
  end

  it "exports every team with a header row" do
    result = described_class.call(race.id)

    expect(CSV.parse(result[:data]).size).to eq(3)
    expect(result[:filename]).to eq("race_#{race.id}_export.csv")
    expect(result[:type]).to eq("text/csv; charset=utf-8; header=present")
  end

  it "exports only finalized teams when asked" do
    expect(CSV.parse(described_class.call(race.id, finalized: true)[:data]).size).to eq(2)
  end
end
