source 'https://rubygems.org'
ruby '2.7.7'

gem 'bootstrap-sass'
gem 'bootswatch-rails'

# Reduces boot times through caching; required in config/boot.rb
gem 'bootsnap', require: false

group :production do
  gem 'rails_12factor' # 12 factor support for rails (http://12factor.net/)
  gem 'newrelic_rpm'
  gem 'rollbar'
end

gem 'authlogic', '~> 6.4.0'  # authentication
gem 'scrypt', '~> 3.0'
# See: https://github.com/CanCanCommunity/cancancan/blob/develop/docs/migrating.md#from-2x-to-3x
gem 'cancancan', '~> 3.5.0'  # authorization
gem 'role_model', '~> 0.8.2' # roles

# payments
gem 'stripe', '~> 1.58.0'

gem 'pg'
gem 'json-schema'

# google analytics
gem 'rack-tracker'

# pub/sub
gem 'wisper-activerecord'

gem 'nokogiri'
gem 'oj'

gem 'rails', '~> 7.1'
# locking psych < 4 mitigates https://stackoverflow.com/questions/71191685/visit-psych-nodes-alias-unknown-alias-default-psychbadalias
# TODO: remove once at Ruby 3.1+
gem 'psych', '< 4'
# newer versions of rdoc depend on psych 4+
gem 'rdoc', '~> 6.3.3'

# Use unicorn as the app server (heroku)
gem 'unicorn'
# Use Puma as the app server
# see https://yuanjiang.space/switch-rails-server-from-unicorn-to-puma
# gem 'puma', '~> 3.0'

gem 'responders' # responds_to support

# Use SCSS for stylesheets
gem 'sass-rails' #, '~> 7.0'

# Use Uglifier as compressor for JavaScript assets
gem 'uglifier' #, '>= 1.3.0'

# Use CoffeeScript for .js.coffee assets and views
gem 'coffee-rails'

gem 'haml'
gem 'haml-rails'
gem 'kaminari'

gem 'awesome_print'
gem 'httpclient'

# See https://github.com/sstephenson/execjs#readme for more supported runtimes
#gem 'libv8'
gem 'libv8-node'

# Use jquery as the JavaScript library
gem 'jquery-rails'

# Turbolinks makes navigating your web application faster. Read more: https://github.com/turbolinks/turbolinks
#gem 'turbolinks', '~> 5'
# Build JSON APIs with ease. Read more: https://github.com/rails/jbuilder
gem 'jbuilder'

# workers
gem 'sidekiq'
gem 'sidekiq-failures'
#gem 'redis-namespace'

group :development do
  # Access an IRB console on exception pages or by using <%= console %> anywhere in the code.
  gem 'web-console'
  gem 'listen'
  gem 'capistrano'
end

group :test do
  gem 'rails-controller-testing'
  gem 'test-unit'
  gem 'wisper-rspec'
  gem 'webmock'
  gem 'simplecov'
  gem 'simplecov_json_formatter', '~> 0.1.4'
  gem 'stripe-ruby-mock', '~> 2.4.1'
  gem 'codeclimate-test-reporter'
  gem 'zonebie'
  gem 'timecop'
  gem 'rspec_junit_formatter'
end

group :test, :development do
  gem 'rspec-rails'
  gem 'factory_bot_rails'
  gem 'dotenv-rails'
  # Call 'byebug' anywhere in the code to stop execution and get a debugger console
  gem 'byebug', platform: :mri
  gem 'rubocop-rails'
end

group :doc do
  # bundle exec rake doc:rails generates the API under doc/api.
  gem 'sdoc', require: false
end

# Use ActiveModel has_secure_password
# gem 'bcrypt-ruby', '~> 3.0.0'

gem 'tzinfo-data'
