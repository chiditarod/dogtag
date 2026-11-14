require "spec_helper"

describe "races/_race_metadata", type: :view do
  let(:race) do
    FactoryBot.create(:race, registration_open: Time.utc(2026, 12, 15, 6), registration_close: Time.utc(2027, 2, 15, 6),
      final_edits_close: Time.utc(2027, 2, 20, 6), race_datetime: Time.utc(2027, 3, 6, 16))
  end

  it "shows a Dec 15 00:00 CT opening as Dec 15 and a midnight close as the day before" do
    Timecop.travel(Time.utc(2026, 12, 1)) do
      render partial: "races/race_metadata", locals: { race: race }
    end

    expect(rendered).to include("December 15, 2026")
    expect(rendered).not_to include("December 14, 2026")
    expect(rendered).to include("February 14, 2027")
  end

  it "shows a midnight close with its time while registration is open" do
    Timecop.travel(Time.utc(2027, 1, 10)) do
      render partial: "races/race_metadata", locals: { race: race }
    end

    expect(rendered).to include("February 14, 2027 at 11:59 PM CST")
  end
end
