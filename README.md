Use this project to bootstrap a Rails 4.0 application.

System Requirements
-------------------
* Use these
[Instructions](http://www.interworks.com/blogs/ckaukis/2013/03/05/installing-ruby-200-rvm-and-homebrew-mac-os-x-108-mountain-lion)
to setup your base system with homebrew.

* Install Ruby 2.0
```bash
rvm requirements
rvm get stable
rvm install ruby-2.0.0-p247
```

Project Setup
-------------
* Create a new git repo.  For our example we'll call it `<your-project>`.

* Clone your repo and ensure you include the -o flag so that
`rails-skeleton` isn't your default remote origin (-o says setup a remote
called `rails-skeleton`)

  ```bash
  git clone git@github.com:ometa/rails-skeleton <your_project> -o rails-skeleton
  cd <your_project>
  ```

* Set up the reference to your own git repository.  The -u flag sets up your 
repo to be the default remote for push and pull requests.

  ```bash
  git remote add origin git@github.com:path/to/<your_project>
  ```

* Customize some files.

  * Edit `.ruby-gemset` and change your gemset name to `<your-project>`.

  * You may also want to edit `config/database.yml` to update the database names.

* Install and run bundler.

  ```bash 
  gem install bundler
  bundle install
  ```
 
* Push the code.

  ```bash
  git push -u origin HEAD:master
  ```

* Now you're ready to rock your app.

How this repo was setup
-----------------------

* Setup Rails
  ```bash
  gem install rails
  rails new .
  ```

* Added rspec to Gemfile
  ```ruby
  group :test, :development do
      gem 'rspec'
      gem 'rspec-rails'
  end
  ```

* Setup rspec 
 
  ```bash
  rm -Rf test/
  rails g rspec:install
  ```
