source 'https://rubygems.org'
ruby "2.1.5"

# -------------------------------------------------------
# rails-skeleton

gem 'bootstrap-sass'
gem 'bootswatch-rails'

group :production do
  # 12 factor support for rails (http://12factor.net/)
  gem 'rails_12factor'
  gem 'newrelic_rpm'
end

# -------------------------------------------------------
# BEGIN dogtag gems

gem 'authlogic', '~> 3.4.0'     # authentication
gem 'cancan', '~> 1.6.10'       # authorization
gem 'role_model', '~> 0.8.1'    # roles

# payments
gem 'stripe', :git => 'https://github.com/stripe/stripe-ruby'

gem 'pg', '~> 0.18.1'           # postgres for heroku
gem 'json-schema'               # validate incoming jsonform

# END dogtag gems
# -------------------------------------------------------

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '~> 4.0.2'
#gem 'rails', '4.1.6'

# Use SCSS for stylesheets
gem 'sass-rails', '~> 4.0.3'

# Use Uglifier as compressor for JavaScript assets
gem 'uglifier', '>= 1.3.0'

# Use CoffeeScript for .js.coffee assets and views
gem 'coffee-rails', '~> 4.0.1'

gem 'haml'
gem 'haml-rails'

# See https://github.com/sstephenson/execjs#readme for more supported runtimes
# gem 'therubyracer', platforms: :ruby

# Use jquery as the JavaScript library
gem 'jquery-rails'

# Turbolinks makes following links in your web application faster. Read more: https://github.com/rails/turbolinks
#gem 'turbolinks'

# Build JSON APIs with ease. Read more: https://github.com/rails/jbuilder
gem 'jbuilder', '~> 1.2'

group :development do
  gem 'capistrano'
  gem 'mailcatcher'
  gem 'guard-rspec', require: false
end

group :test do
  gem 'webmock', '1.15.2'
  gem 'simplecov', '0.8.2'
  gem 'stripe-ruby-mock', '~> 2.0.1'
end

group :test, :development do
  gem 'rspec', '~> 2.14.0'
  gem 'rspec-rails'
  gem 'factory_girl_rails', '4.3.0'
end

group :doc do
  # bundle exec rake doc:rails generates the API under doc/api.
  gem 'sdoc', require: false
end

# Use ActiveModel has_secure_password
# gem 'bcrypt-ruby', '~> 3.0.0'

# Use unicorn as the app server (heroku)
gem 'unicorn', '4.8.0'

# Use debugger
# gem 'debugger', group: [:development, :test]
