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
    it "#{partial} shows a refunded label with real text and not the paid amount" do
      requirement = instance_exec(&build)
      cr = requirement.complete(team.id, team.user, "charge_id" => "mock_ch_1", "customer_id" => "cus_1", "amount" => 5000)
      cr.update_columns(refunded_at: Time.current)

      render partial: "requirements/#{partial}", locals: { team: team, req: requirement.reload }

      expect(rendered).to include("Refunded")
      expect(rendered).not_to include("translation_missing")
      expect(rendered).not_to include("50.00")
    end
  end
end
