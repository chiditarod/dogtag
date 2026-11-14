require "spec_helper"

describe Workers::ClassyFundraisingTeamEmail do
  let(:worker) { described_class.new }

  describe "#perform" do
    let(:team) { FactoryBot.create :team, :with_classy_fundraising_page }

    it "delivers one email to the captain announcing fundraising is ready" do
      expect { worker.perform("team_id" => team.id) }
        .to change { ActionMailer::Base.deliveries.count }.from(0).to(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.to).to eq([team.user.email])
      expect(mail.subject).to include("Fundraising is ready for #{team.name}")
    end

    it "raises when the team does not exist" do
      expect { worker.perform("team_id" => 0) }.to raise_error(ActiveRecord::RecordNotFound)
      expect(ActionMailer::Base.deliveries).to be_empty
    end
  end
end
