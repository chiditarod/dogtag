require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Dogtag
  class Application < Rails::Application
    # Rails 5.2 -> 6.1 -> 7.0
    config.load_defaults 7.0

    # Rails 5.2 -> 6.0
    # The new configuration point config.add_autoload_paths_to_load_path is true by default for backwards compatibility, but allows you to opt-out from adding the autoload paths to $LOAD_PATH. By opting-out you optimize $LOAD_PATH lookups (less directories to check), and save Bootsnap work and memory consumption, since it does not need to build an index for these directories.
    # TODO: try setting this to false
    config.add_autoload_paths_to_load_path = true

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration should go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded.

    # Set Time.zone default to the specified zone and make Active Record auto-convert to this zone.
    # Run "rake -D time" for a list of tasks for finding time zone names. Default is UTC.
    config.time_zone = 'Central Time (US & Canada)'

    # Migrated from Rails 4.2
    I18n.enforce_available_locales = true
    # Include the lib/ directory
    config.eager_load_paths << Rails.root.join('lib')
  end
end
