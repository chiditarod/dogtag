require "spec_helper"

describe "API v1 staff payments", type: :request do
  let!(:race) { FactoryBot.create(:race) }
  let!(:requirement) { FactoryBot.create(:payment_requirement, name: "Cart Deposit", race: race) }
  let(:owner) { FactoryBot.create(:user, first_name: "Olive", last_name: "Owner", email: "olive@fake.com") }
  let!(:payment) do
    team = FactoryBot.create(:team, race: race, user: owner, name: "Wheelie Good")
    FactoryBot.create(:completed_requirement, requirement: requirement, team: team, user: owner, charge_id: "ch_1", amount_cents: 5000)
  end

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/payments"
      expect(response).to have_http_status(:unauthorized)
    end

    it "is 403 for a racer" do
      api_login(FactoryBot.create(:user))
      get "/api/v1/staff/payments"
      expect(response).to have_http_status(:forbidden)
      expect(json["payments"]).to be_nil
    end

    %i[refunder_user operator_user admin_user].each do |factory|
      it "is 200 for a #{factory.to_s.delete_suffix("_user")}" do
        api_login(FactoryBot.create(factory))
        get "/api/v1/staff/payments"
        expect(response).to have_http_status(:ok)
      end
    end
  end

  context "as a refunder" do
    let(:refunder) { FactoryBot.create(:refunder_user, first_name: "Rey", last_name: "Funder") }

    before { api_login(refunder) }

    it "lists payments with the documented shape" do
      get "/api/v1/staff/payments"

      expect(json["payments"].size).to eq(1)
      row = json["payments"].first
      expect(row).to include(
        "id" => payment.id, "payment_type" => "Cart Deposit", "amount_cents" => 5000, "status" => "paid",
        "refunded_at" => nil, "refunded_by" => nil,
        "race" => { "id" => race.id, "name" => race.name },
        "team" => { "id" => payment.team_id, "name" => "Wheelie Good" },
        "owner" => { "name" => "Olive Owner", "email" => "olive@fake.com" },
        "paid_by" => { "name" => "Olive Owner", "email" => "olive@fake.com" }
      )
      expect(row["paid_at"]).to be_present
      expect(json["meta"]).to include(
        "page" => 1, "per_page" => 25, "total_count" => 1, "total_pages" => 1, "refund_batch_limit" => 5,
        "summary" => { "count" => 1, "refunded_count" => 0, "total_cents" => 5000, "refunded_cents" => 0 }
      )
      expect(json["filters"]).to include(
        "race_id" => race.id,
        "races" => [{ "id" => race.id, "name" => race.name, "registration_status" => "open" }],
        "payment_types" => [{ "id" => requirement.id, "name" => "Cart Deposit" }]
      )
    end

    it "shows a refund found already made at Stripe as done at Stripe" do
      payment.update_columns(refunded_at: Time.utc(2026, 11, 20, 12), refunded_by_id: nil, stripe_refund_id: "re_dashboard")

      get "/api/v1/staff/payments"

      expect(json["payments"].first).to include("status" => "refunded", "refunded_by" => { "name" => "Done at Stripe" })
    end

    it "shows no refunder for a refund with no recorded Stripe refund (backfilled)" do
      payment.update_columns(refunded_at: Time.utc(2026, 11, 20, 12), refunded_by_id: nil, stripe_refund_id: nil)

      get "/api/v1/staff/payments"

      expect(json["payments"].first).to include("status" => "refunded", "refunded_by" => nil)
    end

    it "reports who refunded a payment" do
      payment.update!(refunded_at: Time.utc(2026, 11, 20, 12), refunded_by: refunder)

      get "/api/v1/staff/payments"

      expect(json["payments"].first).to include("status" => "refunded", "refunded_by" => { "name" => "Rey Funder" })
      expect(Time.iso8601(json["payments"].first["refunded_at"])).to eq(Time.utc(2026, 11, 20, 12))
    end

    it "defaults to the newest open race, and race_id=all lists every race" do
      other_race = FactoryBot.create(:race, race_datetime: 3.5.weeks.from_now)
      other_requirement = FactoryBot.create(:payment_requirement, race: other_race)
      other_team = FactoryBot.create(:team, race: other_race)
      FactoryBot.create(:completed_requirement, requirement: other_requirement, team: other_team, charge_id: "ch_2", amount_cents: 100)

      get "/api/v1/staff/payments"
      expect(json["payments"].map { |row| row["id"] }).to eq([payment.id])

      get "/api/v1/staff/payments", params: { race_id: "all" }
      expect(json["payments"].size).to eq(2)
      expect(json["meta"]["summary"]["count"]).to eq(2)
    end

    it "filters by team_id, and an unknown team lists nothing" do
      other_team = FactoryBot.create(:team, race: race)
      FactoryBot.create(:completed_requirement, requirement: requirement, team: other_team, charge_id: "ch_other", amount_cents: 100)

      get "/api/v1/staff/payments", params: { team_id: payment.team_id }
      expect(json["payments"].map { |row| row["id"] }).to eq([payment.id])
      expect(json["meta"]["summary"]["count"]).to eq(1)
      expect(json["filters"]["team"]).to eq("id" => payment.team_id, "name" => "Wheelie Good", "race_id" => race.id)

      get "/api/v1/staff/payments", params: { team_id: "999999" }
      expect(json["payments"]).to eq([])
      expect(json["filters"]).to include("team" => nil, "team_id" => 999_999)
    end

    it "filters by payment_type and status" do
      other = FactoryBot.create(:payment_requirement, name: "Registration", race: race)
      team = FactoryBot.create(:team, race: race)
      refunded = FactoryBot.create(:completed_requirement, requirement: other, team: team, charge_id: "ch_3", amount_cents: 100, refunded_at: 1.day.ago)

      get "/api/v1/staff/payments", params: { payment_type: other.id }
      expect(json["payments"].map { |row| row["id"] }).to eq([refunded.id])

      get "/api/v1/staff/payments", params: { status: "paid" }
      expect(json["payments"].map { |row| row["id"] }).to eq([payment.id])

      get "/api/v1/staff/payments", params: { status: "refunded" }
      expect(json["payments"].map { |row| row["id"] }).to eq([refunded.id])
    end

    it "q matches team name, payer, owner and racer email, case-insensitively" do
      payer = FactoryBot.create(:user, email: "payer.person@fake.com")
      payment.update_columns(user_id: payer.id)
      FactoryBot.create(:person, team: payment.team, email: "racer.one@example.com")
      other_team = FactoryBot.create(:team, race: race, name: "Nobody")
      FactoryBot.create(:completed_requirement, requirement: requirement, team: other_team, charge_id: "ch_4", amount_cents: 100)

      ["wheelie", "PAYER.PERSON", "OLIVE@fake", "Racer.One"].each do |term|
        get "/api/v1/staff/payments", params: { q: term }
        expect(json["payments"].map { |row| row["id"] }).to eq([payment.id]), "q=#{term}"
      end
    end

    it "q treats % and _ literally" do
      get "/api/v1/staff/payments", params: { q: "%" }
      expect(json["payments"]).to be_empty

      get "/api/v1/staff/payments", params: { q: "Wheelie_Good" }
      expect(json["payments"]).to be_empty
    end

    it "pages 25 per page in created_at desc, id desc order" do
      base = Time.utc(2026, 11, 1, 12)
      extra = Array.new(26) do |i|
        team = FactoryBot.create(:team, race: race)
        FactoryBot.create(:completed_requirement, requirement: requirement, team: team, charge_id: "ch_p#{i}", amount_cents: 100, created_at: base + i.minutes)
      end
      newest_first = ([payment] + extra).sort_by { |cr| [cr.created_at, cr.id] }.reverse.map(&:id)

      get "/api/v1/staff/payments"
      expect(json["payments"].map { |row| row["id"] }).to eq(newest_first.first(25))
      expect(json["meta"]).to include("total_count" => 27, "total_pages" => 2)

      get "/api/v1/staff/payments", params: { page: 2 }
      expect(json["payments"].map { |row| row["id"] }).to eq(newest_first.last(2))
    end

    it "answers 200 with no rows for a page far past the end" do
      get "/api/v1/staff/payments", params: { page: "9" * 30 }

      expect(response).to have_http_status(:ok)
      expect(json["payments"]).to be_empty
    end

    it "summary ignores the status filter" do
      FactoryBot.create(:completed_requirement, requirement: requirement, team: FactoryBot.create(:team, race: race),
        charge_id: "ch_5", amount_cents: 2500, refunded_at: 1.day.ago)

      get "/api/v1/staff/payments", params: { status: "paid" }

      expect(json["meta"]["total_count"]).to eq(1)
      expect(json["meta"]["summary"]).to eq("count" => 2, "refunded_count" => 1, "total_cents" => 7500, "refunded_cents" => 2500)
    end

    it "reports the refund_batch_limit in use" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("REFUND_BATCH_LIMIT").and_return("10")

      get "/api/v1/staff/payments"

      expect(json["meta"]["refund_batch_limit"]).to eq(10)
    end
  end
end
