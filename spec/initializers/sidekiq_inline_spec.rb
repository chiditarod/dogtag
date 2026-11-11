require "spec_helper"
require "open3"

# The initializer runs at boot, so each example boots a fresh Rails process.
describe "Sidekiq inline initializer" do
  def sidekiq_mode(env)
    script = 'puts(defined?(Sidekiq::Testing) ? Sidekiq::Testing.inline?.to_s : "unloaded")'
    output, = Open3.capture2e({ "RAILS_ENV" => "test" }.merge(env), Rails.root.join("bin/rails").to_s, "runner", script, chdir: Rails.root.to_s)
    output.lines.last.to_s.strip
  end

  it "does nothing unless SIDEKIQ_INLINE is true" do
    expect(sidekiq_mode("SIDEKIQ_INLINE" => nil)).to eq("unloaded")
    expect(sidekiq_mode("SIDEKIQ_INLINE" => "false")).to eq("unloaded")
  end

  it "runs jobs inline when SIDEKIQ_INLINE is true outside production" do
    expect(sidekiq_mode("SIDEKIQ_INLINE" => "true")).to eq("true")
  end
end
