require "spec_helper"

describe Ability do
  describe "an operator" do
    let(:race) { FactoryBot.create :race }
    let(:ability) { Ability.new(FactoryBot.create(:operator_user)) }

    it "can open the new-requirement form but only create payment requirements" do
      expect(ability.can?(:new, Requirement.new(race: race))).to be(true)
      expect(ability.can?(:create, PaymentRequirement.new(race: race))).to be(true)
      expect(ability.can?(:create, Requirement.new(race: race))).to be(false)
      expect(ability.can?(:destroy, PaymentRequirement)).to be(false)
    end
  end
end
