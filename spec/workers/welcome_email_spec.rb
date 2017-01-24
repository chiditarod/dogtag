require 'spec_helper'

describe Workers::WelcomeEmail do

  let(:worker) { Workers::WelcomeEmail.new }

  describe "#run" do
    let!(:user)  { FactoryGirl.create :user }
    let(:job)    {{ 'user_id' => user.id }}

    it "calls the UserMailer and logs 'complete'" do
      expect(worker).to receive(:log).with("complete")
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      worker.run(job)
      expect(ActionMailer::Base.deliveries.count).to eq(1)
    end
  end
end
