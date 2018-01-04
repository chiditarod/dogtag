#!/bin/sh

env

bundle check || bundle install

exec "$@"
