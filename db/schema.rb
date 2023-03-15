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

ActiveRecord::Schema.define(version: 2018_02_19_041406) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "completed_requirements", force: :cascade do |t|
    t.bigint "team_id"
    t.bigint "requirement_id"
    t.bigint "user_id"
    t.text "metadata"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["requirement_id"], name: "index_completed_requirements_on_requirement_id"
    t.index ["team_id", "requirement_id"], name: "index_completed_requirements_on_team_id_and_requirement_id", unique: true
    t.index ["team_id"], name: "index_completed_requirements_on_team_id"
    t.index ["user_id"], name: "index_completed_requirements_on_user_id"
  end

  create_table "people", force: :cascade do |t|
    t.string "first_name"
    t.string "last_name"
    t.string "email"
    t.string "phone"
    t.string "twitter"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.bigint "team_id"
    t.integer "experience"
    t.string "zipcode", null: false
    t.index ["team_id"], name: "index_people_on_team_id"
  end

  create_table "races", force: :cascade do |t|
    t.string "name"
    t.datetime "race_datetime"
    t.datetime "registration_open"
    t.datetime "registration_close"
    t.integer "max_teams"
    t.integer "people_per_team"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text "jsonform"
    t.string "filter_field"
    t.integer "classy_campaign_id"
    t.integer "classy_default_goal"
    t.datetime "final_edits_close", null: false
  end

  create_table "requirements", force: :cascade do |t|
    t.bigint "race_id"
    t.string "type"
    t.string "name"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["race_id"], name: "index_requirements_on_race_id"
  end

  create_table "teams", force: :cascade do |t|
    t.string "name"
    t.bigint "user_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text "description"
    t.string "twitter"
    t.datetime "notified_at"
    t.integer "race_id"
    t.integer "experience"
    t.string "buddies"
    t.string "wildcard"
    t.text "private_comments"
    t.text "jsonform"
    t.boolean "finalized"
    t.integer "assigned_team_number"
    t.integer "classy_id"
    t.integer "classy_fundraiser_page_id"
    t.index ["race_id"], name: "index_teams_on_race_id"
    t.index ["user_id"], name: "index_teams_on_user_id"
  end

  create_table "tiers", force: :cascade do |t|
    t.bigint "requirement_id"
    t.datetime "begin_at"
    t.integer "price"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["requirement_id"], name: "index_tiers_on_requirement_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "first_name"
    t.string "last_name"
    t.string "phone"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string "email", default: "", null: false
    t.string "crypted_password", default: "", null: false
    t.string "password_salt", default: "", null: false
    t.string "persistence_token", default: "", null: false
    t.string "single_access_token", default: "", null: false
    t.string "perishable_token", default: "", null: false
    t.integer "login_count", default: 0, null: false
    t.integer "failed_login_count", default: 0, null: false
    t.datetime "last_request_at"
    t.datetime "current_login_at"
    t.datetime "last_login_at"
    t.string "current_login_ip"
    t.string "last_login_ip"
    t.string "stripe_customer_id"
    t.integer "roles_mask"
    t.integer "classy_id"
  end

end
