dogTag
======

[![Code Climate](https://codeclimate.com/github/ometa/dogtag.png)](https://codeclimate.com/github/ometa/dogtag)

[chiditarod.org](http://chiditarod.org) registration and racer management system

Developer Setup
---

1. Setup

        bundle -j10

1. Export required environment vars

        export PUBLISHABLE_KEY=<foo>
        export SECRET_KEY=<bar>
        export RAILS_SECRET_TOKEN=<baz>

1. Run local daemons/servers

        postgres -D /usr/local/var/postgres
        mailcatcher
        rails s
