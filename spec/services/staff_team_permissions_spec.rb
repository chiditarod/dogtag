require "spec_helper"

describe StaffTeamPermissions do
  let(:race) { FactoryBot.create(:race_with_jsonform) }
  let(:team) { FactoryBot.create(:team, :with_enough_people, race: race) }
  let(:operator) { FactoryBot.create(:operator_user) }
  let(:admin) { FactoryBot.create(:admin_user) }
  let(:refunder) { FactoryBot.create(:refunder_user) }

  def permissions(user, subject_team = team) = described_class.new(subject_team, user).to_h

  # Moves the race's dates so it is closed, with final edits still open (or over).
  def close_registration(final_edits_open: true)
    race.update_columns(
      registration_close: 1.day.ago,
      final_edits_close: final_edits_open ? 1.day.from_now : 1.hour.ago
    )
  end

  it "is a hash of booleans with every key" do
    expect(permissions(operator).keys).to contain_exactly(
      :update_team, :set_captain, :add_racers, :edit_racers, :remove_racers, :edit_questions,
      :delete_team, :take_payment, :set_new_team, :view_emails, :view_payments
    )
    expect(permissions(operator).values).to all(satisfy { |value| value == true || value == false })
  end

  context "an operator after registration closed, inside the final-edits window" do
    before { team && close_registration }

    it "can still act on the team" do
      result = permissions(operator)

      expect(result).to include(
        update_team: true, set_captain: true, add_racers: true, edit_racers: true, remove_racers: true,
        edit_questions: true, take_payment: true, set_new_team: true, view_emails: true, view_payments: true
      )
    end
  end

  context "an operator after the final-edits window" do
    before { team && close_registration(final_edits_open: false) }

    it "cannot add or edit racers but can still update the team and take payment" do
      result = permissions(operator)

      expect(result).to include(add_racers: false, edit_racers: false, update_team: true, take_payment: true)
    end
  end

  context "a refunder or the racer who owns the team, registration closed" do
    before { team && close_registration }

    it "cannot edit the questions" do
      expect(permissions(refunder)[:edit_questions]).to be(false)
      expect(permissions(team.user)[:edit_questions]).to be(false)
      expect(described_class.questions_open?(team, refunder)).to be(false)
      expect(described_class.questions_open?(team, team.user)).to be(false)
      expect(described_class.questions_open?(team, operator)).to be(true)
    end
  end

  context "a refunder on an open race" do
    it "can only view payments" do
      result = permissions(refunder)

      expect(result.select { |_, allowed| allowed }.keys).to eq([:view_payments])
    end
  end

  context "a race without a JSONForm" do
    let(:race) { FactoryBot.create(:race) }

    it "has no questions to edit" do
      expect(permissions(team.user)[:edit_questions]).to be(false)
      expect(permissions(operator)[:edit_questions]).to be(false)
    end
  end

  describe "delete_team" do
    # No JSONForm, so the team has no questions left to answer and finalizes.
    let(:race) { FactoryBot.create(:race) }
    let(:team) { FactoryBot.create(:finalized_team, race: race) }

    it "is true for an admin when nothing was paid" do
      expect(team).to be_finalized
      expect(permissions(admin)[:delete_team]).to be(true)
    end

    it "is false for an admin once a payment is recorded" do
      FactoryBot.create(:completed_requirement, team: team, requirement: FactoryBot.create(:payment_requirement, race: race), user: team.user)

      expect(permissions(admin)[:delete_team]).to be(false)
    end

    it "is false for an operator because a finalized team is not deletable" do
      expect(permissions(operator)[:delete_team]).to be(false)
    end
  end

  context "the owner who is not staff, registration open" do
    it "can update the team but has none of the staff tools" do
      result = permissions(team.user)

      expect(result).to include(update_team: true, take_payment: false, set_new_team: false, view_emails: false, view_payments: false)
    end
  end

  describe ".new_team_setter?" do
    it "is true for admins and operators only" do
      expect(described_class.new_team_setter?(admin)).to be(true)
      expect(described_class.new_team_setter?(operator)).to be(true)
      expect(described_class.new_team_setter?(refunder)).to be(false)
      expect(described_class.new_team_setter?(team.user)).to be(false)
    end
  end
end
