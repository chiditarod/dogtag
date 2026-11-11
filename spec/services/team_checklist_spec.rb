require "spec_helper"

describe TeamChecklist do
  subject(:checklist) { TeamChecklist.new(team).to_h }

  let(:race) { FactoryBot.create(:race_with_jsonform) }
  let(:team) { FactoryBot.create(:team, race: race) }

  context "with an empty team in a race with questions and a fee" do
    before { FactoryBot.create(:payment_requirement_with_tier, race: race) }

    it "has three items remaining" do
      expect(checklist[:remaining]).to eq(3)
      expect(checklist[:racers]).to eq(filled: 0, total: race.people_per_team, done: false)
      expect(checklist[:questions]).to eq(required: true, done: false)
      expect(checklist[:finalized]).to eq(false)
      expect(checklist[:team_number]).to be_nil
      expect(checklist[:classy_fundraising_url]).to be_nil
      expect(checklist[:classy_expected]).to eq(false)
    end
  end

  context "with a full roster" do
    before { FactoryBot.create_list(:person, race.people_per_team, team: team) }

    it "marks racers done" do
      expect(checklist[:racers]).to eq(filled: race.people_per_team, total: race.people_per_team, done: true)
    end
  end

  context "when the race has no jsonform" do
    let(:race) { FactoryBot.create(:race) }

    it "does not require questions" do
      expect(checklist[:questions]).to eq(required: false, done: true)
    end

    it "does not count questions as remaining" do
      expect(checklist[:remaining]).to eq(1)
    end
  end

  context "when the race has no payment requirement" do
    it "treats the fee as done" do
      expect(checklist[:fee]).to eq(done: true, amount_due_cents: nil, paid_cents: 0, next_tier: nil, requirement_id: nil)
    end
  end

  context "with a payment requirement" do
    let!(:requirement) { FactoryBot.create(:payment_requirement_with_tier, race: race) }

    it "reports the amount due, and not done, when unpaid" do
      expect(checklist[:fee]).to include(
        done: false, amount_due_cents: 5000, paid_cents: 0, next_tier: nil, requirement_id: requirement.id
      )
    end

    it "reports the next tier" do
      begin_at = 2.weeks.from_now
      FactoryBot.create(:tier3, requirement: requirement, thetime: Time.zone.now)
      next_tier = TeamChecklist.new(team.reload).to_h[:fee][:next_tier]

      expect(next_tier[:price_cents]).to eq(7000)
      expect(next_tier[:begins_at]).to be_within(1.minute).of(begin_at)
    end

    it "is done with paid_cents once paid" do
      requirement.complete(team.id, team.user, "amount" => 5000)

      expect(TeamChecklist.new(team.reload).to_h[:fee]).to include(done: true, paid_cents: 5000)
    end
  end

  context "with a mock payment requirement" do
    it "uses it as the fee requirement" do
      mock_requirement = MockPaymentRequirement.create!(name: "Mock", race: race)
      FactoryBot.create(:tier, requirement: mock_requirement)

      expect(checklist[:fee]).to include(requirement_id: mock_requirement.id, amount_due_cents: 5000)
    end
  end

  context "with a finalized team" do
    let(:team) { FactoryBot.create(:finalized_team, race: FactoryBot.create(:race)) }

    it "has a team number" do
      expect(checklist[:finalized]).to eq(true)
      expect(checklist[:team_number]).to be_present
      expect(checklist[:team_number]).to eq(team.assigned_team_number)
    end
  end

  context "with a classy id" do
    let(:race) { FactoryBot.create(:race_with_jsonform, :with_classy_data) }
    let(:team) { FactoryBot.create(:team, :with_classy_id, race: race) }

    it "expects a fundraising page and builds the classy fundraising url" do
      expect(checklist[:classy_expected]).to eq(true)
      expect(checklist[:classy_fundraising_url]).to eq(
        "https://www.classy.org/team/#{team.classy_id}?campaignId=#{race.classy_campaign_id}"
      )
    end
  end
end
