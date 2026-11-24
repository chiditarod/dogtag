require "spec_helper"

describe Ability do
  describe "refunding charges" do
    %i[refunder_user operator_user admin_user].each do |factory|
      it "lets a #{factory.to_s.delete_suffix("_user")} refund" do
        expect(Ability.new(FactoryBot.create(factory)).can?(:refund, :charges)).to be(true)
      end
    end

    it "does not let a racer refund" do
      expect(Ability.new(FactoryBot.create(:user)).can?(:refund, :charges)).to be(false)
    end
  end

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
