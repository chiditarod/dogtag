require 'spec_helper'

describe StripeHelper do

  describe "self.safely_call_stripe"

  describe "self.exception_to_hash" do
    context "when there is a json payload" do
      it "parses it into a hash"
    end

    it "creates a basic hash"
  end

  describe "self.log_charge_error" do
    it "calls rails logger"
  end
end
