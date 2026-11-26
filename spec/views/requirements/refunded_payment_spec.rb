require "spec_helper"

describe "requirements payment partials", type: :view do
  let(:race) { FactoryBot.create(:race) }
  let(:team) { FactoryBot.create(:team, race: race) }

  builders = {
    "payment_requirement" => -> { FactoryBot.create(:payment_requirement_with_tier, race: race) },
    "mock_payment_requirement" => lambda {
      MockPaymentRequirement.create!(name: "Mock fee", race: race).tap { |req| Tier.create!(requirement: req, price: 5000, begin_at: 1.day.ago) }
    }
  }

  builders.each do |partial, build|
    context partial do
      let(:requirement) { instance_exec(&build) }
      let(:cr) do
        requirement.complete(team.id, team.user, "charge_id" => "mock_ch_1", "customer_id" => "cus_1", "amount" => 5000)
                   .tap { |payment| payment.update_columns(refunded_at: Time.current) }
      end

      def render_partial(partial, can_reopen:)
        allow(view).to receive(:can?) { |action, _| action == :reopen && can_reopen }
        render partial: "requirements/#{partial}", locals: { team: team, req: requirement.reload }
      end

      it "shows a refunded label with real text and not the paid amount" do
        cr
        render_partial(partial, can_reopen: false)

        expect(rendered).to include("Refunded")
        expect(rendered).not_to include("translation_missing")
        expect(rendered).not_to include("50.00")
        expect(rendered).not_to include("Reopen payment")
      end

      it "offers Reopen payment to someone who may reopen" do
        cr
        render_partial(partial, can_reopen: true)

        expect(rendered).to include("Reopen payment")
        expect(rendered).to include("/completed_requirements/#{cr.id}/reopen")
      end

      it "no longer shows Refunded or the button once the payment is reopened" do
        cr.update_columns(reopened_at: Time.current)
        assign(:race, race)
        assign(:team, team)
        allow(view).to receive(:current_user).and_return(FactoryBot.create(:operator_user))
        render_partial(partial, can_reopen: true)

        expect(rendered).not_to include("Refunded")
        expect(rendered).not_to include("Reopen payment")
      end
    end
  end
end
