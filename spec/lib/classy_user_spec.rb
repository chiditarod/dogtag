require 'spec_helper'

describe ClassyUser do
  describe "#link_user_to_classy!" do
    context "when user already has a classy id in db" do
      it "returns the user object"
    end

    context "when email address is already in classy" do
      it "associates the user with classy and returns the user object"
    end

    context "when email address is not found in classy" do
      it "creates a new classy member, associates the user with classy and returns the user object"
    end
  end
end
