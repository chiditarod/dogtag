require 'spec_helper'

describe Workers::TeamFinalizer do

  let(:worker)  { Workers::TeamFinalizer.new }

  describe "#run" do
    let(:team_id) { 1 }
    let(:job)  {{ 'team_id' => team_id }}
    let(:data) {{
      job: job,
      child_job_ids: {
        team_finalized_email: "foo",
        classy_create_fundraising_team: "bar"
      }
    }}

    it "calls other workers and logs their job ids" do
      expect(worker).to receive(:log).with("received", {job: job})
      expect(Workers::TeamFinalizedEmail).to receive(:perform_async).with({team_id: team_id}).and_return("foo")
      expect(Workers::ClassyCreateFundraisingTeam).to receive(:perform_async).with({team_id: team_id}).and_return("bar")
      expect(worker).to receive(:log).with("complete", data)
      worker.perform(job)
    end
  end
end
