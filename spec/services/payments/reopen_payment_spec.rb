require "spec_helper"

describe Payments::ReopenPayment do
  let(:requirement) { FactoryBot.create(:payment_requirement_with_tier) }
  let(:team) { FactoryBot.create(:team, :with_enough_people, race: requirement.race) }
  let(:operator) { FactoryBot.create(:operator_user) }
  let(:refunder) { FactoryBot.create(:refunder_user) }
  let!(:cr) { pay("ch_1") }

  def pay(charge_id)
    requirement.complete(team.id, team.user, "charge_id" => charge_id, "customer_id" => "cus_1", "amount" => 5000)
  end

  def refund!(payment = cr)
    payment.update_columns(refunded_at: Time.current, refunded_by_id: refunder.id, stripe_refund_id: "re_1")
  end

  def call(payment = cr) = described_class.call(user: operator, completed_requirement: payment)

  context "with a refunded payment" do
    before { refund! }

    it "reopens it, records who and when, and keeps the refund and the row" do
      result = Timecop.freeze(Time.utc(2026, 11, 25, 15, 0, 0)) { call }

      expect(result.ok).to be(true)
      expect(result.code).to eq(:reopened)
      cr.reload
      expect(cr.reopened_at).to eq(Time.utc(2026, 11, 25, 15, 0, 0))
      expect(cr.reopened_by).to eq(operator)
      expect(cr).to be_refunded
      expect(cr.refunded_by).to eq(refunder)
      expect(cr.stripe_refund_id).to eq("re_1")
      expect(cr.charge_id).to eq("ch_1")
    end

    it "makes the requirement incomplete again and lets the team pay again" do
      call

      expect(requirement.completed?(team)).to be(false)
      expect(requirement.cr_for(team)).to be_nil
      expect(team.reload.completed_requirements).to be_empty
      expect(team.all_completed_requirements.count).to eq(1)

      second = pay("ch_2")

      expect(second).to be_persisted
      expect(requirement.completed?(team)).to be(true)
      expect(team.reload.completed_requirements.map(&:charge_id)).to eq(["ch_2"])
      expect(team.all_completed_requirements.map(&:charge_id)).to contain_exactly("ch_1", "ch_2")
    end

    it "counts only the new payment in the team's total" do
      call
      pay("ch_2")

      expect(team.reload.money_paid_in_cents).to eq(5000)
    end

    it "is safe to repeat" do
      call
      first = cr.reload.reopened_at

      result = Timecop.travel(1.hour.from_now) { call }

      expect(result.ok).to be(true)
      expect(result.code).to eq(:already_reopened)
      expect(cr.reload.reopened_at).to eq(first)
    end

    it "does not take the row's place from a payment already made after the reopen" do
      call
      pay("ch_2")

      expect(CompletedRequirement.active.where(team: team, requirement: requirement).count).to eq(1)
      expect { described_class.call(user: operator, completed_requirement: cr) }.not_to raise_error
    end

    it "answers in_progress while another request holds the payment's lock" do
      allow(Payments::AdvisoryLock).to receive(:with_lock).and_return(Payments::AdvisoryLock::HELD)

      result = call

      expect(result.ok).to be(false)
      expect(result.code).to eq(:in_progress)
      expect(cr.reload).not_to be_reopened
    end

    it "reports an unexpected failure without raising" do
      allow(CompletedRequirementAuditor).to receive(:new).and_raise(RuntimeError, "boom")
      allow(Payments::AdvisoryLock).to receive(:alert)

      result = call

      expect(result.ok).to be(false)
      expect(result.code).to eq(:unexpected)
      expect(Payments::AdvisoryLock).to have_received(:alert).with(/boom/)
    end
  end

  it "refuses a payment that was not refunded" do
    result = call

    expect(result.ok).to be(false)
    expect(result.code).to eq(:not_refunded)
    expect(cr.reload).not_to be_reopened
    expect(requirement.completed?(team)).to be(true)
  end

  describe "the team's registration" do
    before do
      refund!
      allow(Workers::TeamFinalizer).to receive(:perform_async)
    end

    it "un-finalizes a finalized team and keeps its team number" do
      expect(team.reload).to be_finalized
      number = team.assigned_team_number
      expect(number).to be_present

      call

      team.reload
      expect(team).not_to be_finalized
      expect(team.notified_at).to be_nil
      expect(team.assigned_team_number).to eq(number)
    end

    it "frees the team's place in the race until it pays again" do
      race = team.race
      expect { call }.to change { race.reload.finalized_teams.count }.by(-1)
    end

    it "leaves a team that was never finalized alone" do
      team.update_columns(finalized: nil)

      expect { call }.not_to change { team.reload.attributes }
    end

    describe "when the team pays again" do
      before { call }

      it "finalizes again with the same team number" do
        number = team.reload.assigned_team_number

        pay("ch_2")

        team.reload
        expect(team).to be_finalized
        expect(team.assigned_team_number).to eq(number)
        expect(Workers::TeamFinalizer).to have_received(:perform_async).with("team_id" => team.id)
      end

      it "sends the confirmation email again but does not create a second Classy team" do
        team.update_columns(classy_id: 777)
        pay("ch_2")
        allow(Workers::TeamFinalizer).to receive(:perform_async).and_call_original
        expect(ClassyClient).not_to receive(:new)

        Sidekiq::Testing.inline! do
          expect { Workers::TeamFinalizer.perform_async("team_id" => team.id) }
            .to change { ActionMailer::Base.deliveries.count { |mail| mail.subject.include?("Registration Confirmed") } }.by(1)
        end

        expect(team.reload.classy_id).to eq(777)
        expect(Workers::ClassyFundraisingTeamEmail.jobs).to be_empty
      end
    end
  end
end
