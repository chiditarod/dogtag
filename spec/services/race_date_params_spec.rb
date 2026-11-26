require "spec_helper"

RSpec.describe RaceDateParams do
  let(:zone) { ActiveSupport::TimeZone["America/Chicago"] }

  def call(attrs)
    described_class.call(attrs, zone: zone)
  end

  it "parses a wall-clock time in the race's zone" do
    parsed, errors = call("race_datetime" => "2026-12-07T12:00")

    expect(parsed["race_datetime"]).to eq(zone.parse("2026-12-07 12:00"))
    expect(parsed["race_datetime"].utc_offset).to eq(-6 * 3600)
    expect(errors).to eq({})
  end

  it "keeps seconds" do
    parsed, = call("registration_open" => "2026-12-07T12:00:30")

    expect(parsed["registration_open"]).to eq(zone.parse("2026-12-07 12:00:30"))
    expect(parsed["registration_open"].sec).to eq(30)
  end

  it "refuses a time inside the spring-forward gap" do
    parsed, errors = call("registration_close" => "2027-03-14T02:30")

    expect(parsed).not_to have_key("registration_close")
    expect(errors["registration_close"]).to eq(
      ["doesn't exist in America/Chicago: the clocks jump forward that night"]
    )
  end

  it "accepts a time in the fall-back overlap" do
    parsed, errors = call("final_edits_close" => "2027-11-07T01:30")

    expect(parsed["final_edits_close"].strftime("%Y-%m-%dT%H:%M")).to eq("2027-11-07T01:30")
    expect(errors).to eq({})
  end

  it "rejects a malformed value" do
    parsed, errors = call("race_datetime" => "12/07/2026")

    expect(parsed).to eq({})
    expect(errors["race_datetime"]).to eq(["must be a date and time"])
  end

  it "rejects a shape-valid but impossible date without raising" do
    %w[2026-13-45T00:00 2026-02-30T10:00 2026-12-07T25:00].each do |value|
      parsed, errors = call("race_datetime" => value)

      expect(parsed).not_to have_key("race_datetime"), value
      expect(errors["race_datetime"]).to eq(["must be a date and time"]), value
    end
  end

  it "rejects a non-string value without raising" do
    [5, ["a"], { "a" => 1 }, true].each do |value|
      parsed, errors = call("race_datetime" => value)

      expect(parsed).not_to have_key("race_datetime"), value.inspect
      expect(errors["race_datetime"]).to eq(["must be a date and time"]), value.inspect
    end
  end

  it "asks for a value when blank" do
    parsed, errors = call("race_datetime" => "", "registration_open" => nil)

    expect(parsed).to eq({})
    expect(errors["race_datetime"]).to eq(["Enter a date and time"])
    expect(errors["registration_open"]).to eq(["Enter a date and time"])
  end

  it "passes other keys through and leaves absent date keys absent" do
    parsed, errors = call("name" => "x", "race_datetime" => "2026-12-07T12:00")

    expect(parsed["name"]).to eq("x")
    expect(parsed.keys).to contain_exactly("name", "race_datetime")
    expect(errors).to eq({})
  end
end
