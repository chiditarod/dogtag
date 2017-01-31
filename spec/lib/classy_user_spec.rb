require 'spec_helper'

describe ClassyUser do

  describe "#link_user_to_classy!" do

    let(:race)   { FactoryGirl.create :race }
    let(:result) { ClassyUser.link_user_to_classy!(user, race) }

    context "when user already has a classy id in db" do
      let(:user) { FactoryGirl.create :user, :with_classy_id }

      it "returns the user object" do
        expect(result).to eq(user)
      end
    end

    context "when user has no classy id" do

      let(:user) { FactoryGirl.create :user }
      let(:cc)   { double(ClassyClient) }

      before do
        expect(ClassyClient).to receive(:new).and_return(cc)
      end

      context "user email address has classy account" do

        it "associates the user with classy and returns the user object" do
          expect(user.classy_id).to be_nil
          expect(cc).to receive(:get_member).and_return({'id' => '123'})
          expect(result.classy_id).to eq(123)
        end
      end

      context "when email address is not found in classy" do

        it "creates a new classy member, associates the user with classy and returns the user object" do
          expect(user.classy_id).to be_nil
          expect(cc).to receive(:get_member).and_return(nil)
          expect(cc).to receive(:get_campaign).and_return({'organization_id' => '123'})
          expect(cc).to receive(:create_member).and_return({'id' => '123'})
          expect(result.classy_id).to eq(123)
        end
      end
    end
  end
end
