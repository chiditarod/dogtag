require 'spec_helper'

describe Workers::TeamFinalizedEmail do

  let(:worker) { Workers::TeamFinalizedEmail.new }

  describe "#run" do
    let!(:team)  { FactoryGirl.create :team, :with_people }
    let(:job)    {{ 'team_id' => team.id }}
    let(:mailer) { double("mailer", deliver_now: true) }

    it "calls the UserMailer and logs 'complete'" do
      expect(worker).to receive(:log).with("received", {job: job})
      expect(worker).to receive(:log).with("complete")
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      worker.perform(job)
      expect(ActionMailer::Base.deliveries.count).to eq(1)
    end
  end
end
