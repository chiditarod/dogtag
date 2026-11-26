require "spec_helper"

describe "API v1 staff team", type: :request do
  let!(:race) { FactoryBot.create(:race_with_jsonform) }
  let!(:owner) { FactoryBot.create(:user, first_name: "Olive", last_name: "Owner", email: "olive@example.com", phone: "312-555-0100") }
  let!(:team) { FactoryBot.create(:team, :with_people, user: owner, race: race, collaborating: true, other_buddies: "The Rollers") }

  describe "authorization" do
    it "is 401 when logged out" do
      get "/api/v1/staff/teams/#{team.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "is 403 for a racer, including the team's owner, and for an unknown id" do
      api_login(owner)
      get "/api/v1/staff/teams/#{team.id}"
      expect(response).to have_http_status(:forbidden)
      expect(json["staff_team"]).to be_nil
      get "/api/v1/staff/teams/0"
      expect(response).to have_http_status(:forbidden)
    end

    %i[refunder_user operator_user admin_user].each do |factory|
      it "is 200 for #{factory}" do
        api_login(FactoryBot.create(factory))
        get "/api/v1/staff/teams/#{team.id}"
        expect(response).to have_http_status(:ok)
      end
    end

    it "is 404 for an unknown id" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/teams/0"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "payload" do
    let(:buddy) { FactoryBot.create(:team, race: race, name: "Buddy Team") }
    let(:paid_requirement) { FactoryBot.create(:payment_requirement_with_tier, race: race, name: "Entry Fee") }
    let(:refunded_requirement) { FactoryBot.create(:payment_requirement_with_tier, race: race, name: "Cart Deposit") }

    before do
      team.update_columns(captain_id: team.people.first.id)
      FactoryBot.create(:team_buddy, team: team, buddy_team: buddy)
      2.times { FactoryBot.create(:sent_email, team: team) }
      FactoryBot.create(:sent_email, team: buddy)
      FactoryBot.create(:completed_requirement, requirement: paid_requirement, team: team, user: owner,
        charge_id: "ch_paid", amount_cents: 5000, created_at: 2.days.ago)
      FactoryBot.create(:completed_requirement, requirement: refunded_requirement, team: team, user: owner,
        charge_id: "ch_refunded", amount_cents: 2500, refunded_at: Time.current, created_at: 1.day.ago)
    end

    it "gives the staff view of the team" do
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/teams/#{team.id}"

      body = json["staff_team"]
      expect(body.keys).to match_array(%w[id race_id finalized team_number new_team new_team_overridden new_team_setting
                                          computed_new_team years_raced collaborating racing_with captain captain_inferred
                                          account_holder sent_emails_count payments can])
      expect(body).to include("id" => team.id, "race_id" => race.id, "finalized" => false, "collaborating" => true,
        "sent_emails_count" => 2, "captain_inferred" => false, "new_team_overridden" => false, "new_team_setting" => "auto")
      expect(body["racing_with"]).to eq(team.reload.racing_with_names)
      expect(body["racing_with"]).to eq(["Buddy Team", "The Rollers"])
      expect(body["years_raced"]).to eq(team.person_experience)
      expect(body["computed_new_team"]).to eq(team.computed_new_team)
      captain = team.captain
      expect(body["captain"]).to eq("id" => captain.id, "first_name" => captain.first_name, "last_name" => captain.last_name,
        "email" => captain.email, "phone" => captain.phone)
      expect(body["account_holder"]).to eq("id" => owner.id, "first_name" => "Olive", "last_name" => "Owner",
        "email" => "olive@example.com", "phone" => "312-555-0100")
      expect(body["payments"].map { |p| p.slice("name", "amount_cents", "status", "requirement_id") }).to eq([
        { "name" => "Entry Fee", "amount_cents" => 5000, "status" => "paid", "requirement_id" => paid_requirement.id },
        { "name" => "Cart Deposit", "amount_cents" => 2500, "status" => "refunded", "requirement_id" => refunded_requirement.id }
      ])
      expect(body["payments"].first.keys).to match_array(%w[id requirement_id name amount_cents paid_at status])
      expect(body["can"].keys).to match_array(%w[update_team set_captain add_racers edit_racers remove_racers edit_questions
                                                 delete_team take_payment set_new_team view_emails view_payments])
      expect(body["can"]).to include("take_payment" => true, "set_new_team" => true, "view_emails" => true, "view_payments" => true)
    end

    it "gives a team with no captain a null captain" do
      team.update_columns(captain_id: nil)
      api_login(FactoryBot.create(:operator_user))
      get "/api/v1/staff/teams/#{team.id}"
      expect(json["staff_team"]["captain"]).to be_nil
    end

    it "gives a refunder the card read-only" do
      api_login(FactoryBot.create(:refunder_user))
      get "/api/v1/staff/teams/#{team.id}"

      can = json["staff_team"]["can"]
      expect(can.reject { |key, _| key == "view_payments" }.values).to all(be(false))
      expect(can["view_payments"]).to be(true)
    end
  end
end
