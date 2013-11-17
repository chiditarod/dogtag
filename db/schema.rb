# encoding: UTF-8
# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20131113085527) do

  create_table "people", force: true do |t|
    t.string  "first_name"
    t.string  "last_name"
    t.string  "email"
    t.string  "phone"
    t.string  "twitter"
    t.integer "team_id"
  end

  create_table "races", force: true do |t|
    t.string   "name"
    t.datetime "race_datetime"
    t.integer  "max_teams"
    t.integer  "people_per_team"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "teams", force: true do |t|
    t.string   "name"
    t.text     "description"
    t.string   "twitter"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "race_id"
  end

end
