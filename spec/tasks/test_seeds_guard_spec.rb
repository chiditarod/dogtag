require "spec_helper"
require "rake"

describe "test_seeds:guard" do
  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("test_seeds:guard")
  end

  around do |example|
    saved = ENV["ALLOW_TEST_SEEDS_IN_PRODUCTION"]
    ENV["ALLOW_TEST_SEEDS_IN_PRODUCTION"] = nil
    example.run
  ensure
    ENV["ALLOW_TEST_SEEDS_IN_PRODUCTION"] = saved
  end

  def run_guard
    Rake::Task["test_seeds:guard"].reenable
    Rake::Task["test_seeds:guard"].invoke
  end

  it "aborts in production without the opt-in flag" do
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production"))

    expect { run_guard }
      .to output(/disabled in production/).to_stderr
      .and raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
  end

  it "passes in production with ALLOW_TEST_SEEDS_IN_PRODUCTION=true" do
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production"))
    ENV["ALLOW_TEST_SEEDS_IN_PRODUCTION"] = "true"

    expect { run_guard }.not_to raise_error
  end

  it "passes outside production" do
    expect { run_guard }.not_to raise_error
  end

  it "is a prerequisite of every other test_seeds task" do
    tasks = Rake::Task.tasks.select { |t| t.name.start_with?("test_seeds:") && t.name != "test_seeds:guard" }

    expect(tasks).not_to be_empty
    expect(tasks.reject { |t| t.prerequisites.include?("guard") }).to be_empty
  end
end
