redis_url = ENV['REDIS_URL'] || "redis://127.0.0.1:6379/0"

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }
  config.failures_max_count = false # no limit on number of failing jobs in flight
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end
