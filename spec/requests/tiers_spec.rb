require "spec_helper"

describe "Admin tiers", type: :request do
  let(:admin) { FactoryBot.create(:admin_user) }
  let(:requirement) { FactoryBot.create(:payment_requirement) }
  let!(:tier) { FactoryBot.create(:tier, requirement: requirement, begin_at: Time.utc(2026, 12, 15, 6)) }

  before { api_login(admin) }

  def begin_at_fields(year, month, day)
    { "begin_at(1i)" => year.to_s, "begin_at(2i)" => month.to_s, "begin_at(3i)" => day.to_s,
      "begin_at(4i)" => "00", "begin_at(5i)" => "00" }
  end

  it "re-renders the form in the race's zone when an update fails" do
    patch "/tiers/#{tier.id}", params: { tier: { price: "" } }

    expect(response).to have_http_status(:ok)
    page = Nokogiri::HTML(response.body)
    expect(page.at_css("#tier_requirement_id")["value"]).to eq(requirement.id.to_s)
    expect(page.at_css("#tier_begin_at_3i option[selected]")["value"]).to eq("15")
    expect(page.at_css("#tier_begin_at_4i option[selected]")["value"]).to eq("00")
    expect(response.body).to include("Central Time (CST/CDT)")
    expect(tier.reload.price).to eq(5000)
  end

  it "re-renders a failed update in a non-Chicago race's zone" do
    la_requirement = FactoryBot.create(:payment_requirement, race: FactoryBot.create(:race, time_zone: "America/Los_Angeles"))
    la_tier = FactoryBot.create(:tier, requirement: la_requirement, begin_at: Time.utc(2026, 12, 15, 8))

    patch "/tiers/#{la_tier.id}", params: { tier: { price: "" } }

    expect(response).to have_http_status(:ok)
    page = Nokogiri::HTML(response.body)
    expect(page.at_css("#tier_begin_at_3i option[selected]")["value"]).to eq("15")
    expect(page.at_css("#tier_begin_at_4i option[selected]")["value"]).to eq("00")
    expect(response.body).to include("Pacific Time (PST/PDT)")
  end

  it "parses begin_at on each side of the March 2027 DST change in Central time" do
    post "/tiers", params: { tier: { price: 6000, requirement_id: requirement.id }.merge(begin_at_fields(2027, 3, 14)) }
    post "/tiers", params: { tier: { price: 7000, requirement_id: requirement.id }.merge(begin_at_fields(2027, 3, 15)) }

    expect(requirement.tiers.find_by!(price: 6000).begin_at).to eq(Time.utc(2027, 3, 14, 6))
    expect(requirement.tiers.find_by!(price: 7000).begin_at).to eq(Time.utc(2027, 3, 15, 5))
  end
end
