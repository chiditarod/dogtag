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

  describe "reopening a refunded payment" do
    before { payment.update_columns(refunded_at: 1.day.ago, refunded_by_id: FactoryBot.create(:refunder_user).id) }

    it "lists reopened_at and reopened_by, and keeps a reopened payment in the list as refunded" do
      operator = FactoryBot.create(:operator_user, first_name: "Opie", last_name: "Rator")
      api_login(operator)

      get "/api/v1/staff/payments"
      expect(json["payments"].first).to include("reopened_at" => nil, "reopened_by" => nil)

      payment.update_columns(reopened_at: Time.current, reopened_by_id: operator.id)
      get "/api/v1/staff/payments", params: { status: "refunded" }

      expect(json["payments"].size).to eq(1)
      expect(json["payments"].first).to include("status" => "refunded", "reopened_by" => { "name" => "Opie Rator" })
      expect(json["payments"].first["reopened_at"]).to be_present
    end

    it "says whether the viewer may reopen" do
      api_login(FactoryBot.create(:refunder_user))
      get "/api/v1/staff/payments"
      expect(json["can_reopen"]).to be(false)

      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/payments"
      expect(json["can_reopen"]).to be(true)
    end

    %i[operator_user admin_user].each do |factory|
      it "lets #{factory.to_s.delete_suffix("_user")} reopen it" do
        user = FactoryBot.create(factory, first_name: "Sam", last_name: "Staff")
        api_login(user)

        post "/api/v1/staff/payments/#{payment.id}/reopen"

        expect(response).to have_http_status(:ok)
        expect(json).to include("id" => payment.id, "reopened_by" => { "name" => "Sam Staff" })
        expect(json["reopened_at"]).to be_present
        payment.reload
        expect(payment.reopened_by).to eq(user)
        expect(payment.refunded_at).to be_present
      end
    end

    it "is 403 for a refunder and changes nothing" do
      api_login(FactoryBot.create(:refunder_user))

      post "/api/v1/staff/payments/#{payment.id}/reopen"

      expect(response).to have_http_status(:forbidden)
      expect(payment.reload).not_to be_reopened
    end

    it "is 401 logged out, 403 for a racer and 404 for an unknown id" do
      post "/api/v1/staff/payments/#{payment.id}/reopen"
      expect(response).to have_http_status(:unauthorized)

      api_login(FactoryBot.create(:user))
      post "/api/v1/staff/payments/#{payment.id}/reopen"
      expect(response).to have_http_status(:forbidden)

      api_login(FactoryBot.create(:operator_user))
      post "/api/v1/staff/payments/0/reopen"
      expect(response).to have_http_status(:not_found)
    end

    it "is 422 not_refunded for a payment that is still paid" do
      payment.update_columns(refunded_at: nil, refunded_by_id: nil)
      api_login(FactoryBot.create(:operator_user))

      post "/api/v1/staff/payments/#{payment.id}/reopen"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json).to include("error" => "Only a refunded payment can be reopened.", "code" => "not_refunded", "errors" => {})
      expect(payment.reload).not_to be_reopened
    end

    it "is 409 in_progress while the payment is locked" do
      allow(Payments::AdvisoryLock).to receive(:with_lock).and_return(Payments::AdvisoryLock::HELD)
      api_login(FactoryBot.create(:operator_user))

      post "/api/v1/staff/payments/#{payment.id}/reopen"

      expect(response).to have_http_status(:conflict)
      expect(json["code"]).to eq("in_progress")
    end

    it "answers 200 again for a payment that is already reopened, and keeps the first reopen" do
      operator = FactoryBot.create(:operator_user)
      api_login(operator)
      post "/api/v1/staff/payments/#{payment.id}/reopen"
      first = payment.reload.reopened_at

      post "/api/v1/staff/payments/#{payment.id}/reopen"

      expect(response).to have_http_status(:ok)
      expect(json["message"]).to eq("This payment was already reopened.")
      expect(payment.reload.reopened_at).to eq(first)
    end
  end
end
