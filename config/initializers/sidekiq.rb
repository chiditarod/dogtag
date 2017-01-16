redis_host = ENV['REDIS_HOST'] || '127.0.0.1'
redis_port = ENV['REDIS_PORT'] || 6379

# Wire up redis and sidekiq
redis_connection_data = {
  namespace: 'dogtag_sidekiq',
  size: 30,
  url: "redis://#{redis_host}:#{redis_port}"
}

Sidekiq.configure_client do |config|
  config.redis = redis_connection_data
end

Sidekiq.configure_server do |config|
  config.redis = redis_connection_data
  config.failures_max_count = false # no limit on number of failing jobs in flight
end
