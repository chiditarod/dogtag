source 'https://rubygems.org'

# -------------------------------------------------------
# rails-skeleton

# bootstrap 3.0
gem 'bootstrap-sass'

group :production do
  # 12 factor support for rails (http://12factor.net/)
  gem 'rails_12factor'
end

# -------------------------------------------------------
# BEGIN dogtag gems

# authentication
gem 'authlogic',
  :git => 'git://github.com/binarylogic/authlogic',
  :ref => 'abc09970ed1fad98c6c12f4ca64d1670d37d11db'

# authorization
gem 'cancan', '1.6.10'
# roles
gem 'role_model', '0.8.1'

# Payment stuff
gem 'stripe', :git => 'https://github.com/stripe/stripe-ruby'

# postgres for heroku
gem 'pg', '0.17.1'

# END dogtag gems
# -------------------------------------------------------

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '4.0.2'
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
gem 'turbolinks'

# Build JSON APIs with ease. Read more: https://github.com/rails/jbuilder
gem 'jbuilder', '~> 1.2'

group :development do
  gem 'capistrano'
  gem 'mailcatcher'
end

group :test do
  gem 'webmock', '1.15.2'
  gem 'simplecov', '0.8.2'
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
