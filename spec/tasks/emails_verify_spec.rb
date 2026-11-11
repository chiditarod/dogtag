require "spec_helper"
require "rake"

describe "emails:verify" do
  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("emails:verify")
  end

  let(:team) { FactoryBot.create(:team) }

  around do |example|
    saved = ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = nil
    example.run
  ensure
    ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"] = saved
  end

  def run_task
    Rake::Task["emails:verify"].reenable
    Rake::Task["emails:verify"].invoke(team.id.to_s)
  end

  it "prints a line per row and exits 1 when something is missing" do
    expect { run_task }
      .to output(/welcome\s+-\s+MISSING/).to_stdout
      .and raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
  end

  it "prints OK and does not exit when everything is sent" do
    SentEmail.create!(kind: "welcome", status: "sent", user_id: team.user_id, mailer: "UserMailer", recipient: "a@b.com")

    expect { run_task }.to output(/welcome\s+sent\s+OK/).to_stdout
  end
end
