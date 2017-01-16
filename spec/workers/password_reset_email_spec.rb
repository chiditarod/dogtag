require 'spec_helper'

describe Workers::PasswordResetEmail do

  let(:worker) { Workers::PasswordResetEmail.new }

  describe "#run" do
    let!(:user)  { FactoryGirl.create :user }
    let(:job)    {{ 'user_id' => user.id, 'host' => 'http://foo' }}

    it "calls the UserMailer and logs 'complete'" do
      expect(worker).to receive(:log).with("received", {job: job})
      expect(worker).to receive(:log).with("complete")
      expect(ActionMailer::Base.deliveries.count).to eq(0)
      worker.perform(job)
      expect(ActionMailer::Base.deliveries.count).to eq(1)
    end
  end
end