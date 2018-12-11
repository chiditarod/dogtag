# Copyright (C) 2014 Devin Breen
# This file is part of dogtag <https://github.com/chiditarod/dogtag>.
#
# dogtag is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dogtag is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dogtag.  If not, see <http://www.gnu.org/licenses/>.
class MergeRegistrationsIntoTeams < ActiveRecord::Migration

  THEFIELDS = %w(name description twitter created_at updated_at notified_at
                 race_id racer_type primary_inspiration rules_confirmation
                 sabotage_confirmation cart_deposit_confirmation food_confirmation
                 experience buddies wildcard private_comments)

  def up
    # add columns from the registrations table to teams table
    add_columns :teams

    # indexes: a team can only register for a race once
    add_index :teams, :race_id

    # map user ids to registration ids
    reg_to_user = select_all <<-SQL
      SELECT r.id as reg_id, t.user_id as user_id
      FROM registrations as r INNER JOIN teams as t ON r.team_id = t.id
    SQL

    # delete the original teams since we've captured the user_ids
    execute "TRUNCATE teams"

    # migrate the data from the registrations table
    # create new team entries using all of the registration data and the user_id
    select_all('SELECT * FROM registrations').each do |reg|
      tuples = build_sanitized_tuples(reg)
      user_id = reg_to_user.detect { |row| row['reg_id'] == reg['id'] }['user_id']

      execute <<-SQL
        INSERT INTO teams (id, #{THEFIELDS.join(',')}, user_id)
        VALUES (#{reg['id']}, #{THEFIELDS.map { |f| tuples[f] }.join(',')}, #{user_id})
      SQL
    end

    # drop indexes
    remove_index :registrations, column: [:team_id, :race_id]

    # we no longer want this table. all info is now in teams
    drop_table :registrations
  end

  # the only data lost during the rollback is the original team_id, but since
  # a team only ever had a single registration, the data is moot.
  def down
    # build out the registrations table
    create_table(:registrations) do |t|
      t.string "name"
      t.integer "team_id"
      t.timestamps null: true
    end
    add_columns :registrations

    # indexes: a team can only register for a particular race once.
    add_index :registrations, [:team_id, :race_id], :unique => true

    # for each team, create a registration item in the db. assign the team_id
    select_all('SELECT * FROM teams').each do |team|
      tuples = build_sanitized_tuples(team)

      execute <<-SQL
        INSERT INTO registrations (id, #{THEFIELDS.join(',')}, team_id)
        VALUES (#{team['id']}, #{THEFIELDS.map { |f| tuples[f] }.join(',')}, #{team['id']})
      SQL
    end

    # drop indexes
    remove_index :teams, :race_id

    # remove all the columns that are now reflected in registrations table
    remove_columns :teams
  end

  private

  # sanitized each field to copy, then insert into a new hash
  def build_sanitized_tuples(hash)
    THEFIELDS.inject({}) do |result, field|
      result[field] = sanitize_for_sql_insert(hash[field])
      result
    end
  end

  # change ' into '' for SQL insertion
  def sanitize_for_sql_insert(field)
    return 'NULL' unless field
    field.empty? ? 'NULL' : "'#{field.gsub("'", "''")}'"
  end

  def add_columns(table)
    add_column table, :description, :text
    add_column table, :twitter, :string
    add_column table, :notified_at, :datetime
    add_column table, :race_id, :integer
    add_column table, :racer_type, :string
    add_column table, :primary_inspiration, :string
    add_column table, :rules_confirmation, :boolean
    add_column table, :sabotage_confirmation, :boolean
    add_column table, :cart_deposit_confirmation, :boolean
    add_column table, :food_confirmation, :boolean
    add_column table, :experience, :integer
    add_column table, :buddies, :string
    add_column table, :wildcard, :string
    add_column table, :private_comments, :text
  end

  def remove_columns(table)
    remove_column table, :description
    remove_column table, :twitter
    remove_column table, :notified_at
    remove_column table, :race_id
    remove_column table, :racer_type
    remove_column table, :primary_inspiration
    remove_column table, :rules_confirmation
    remove_column table, :sabotage_confirmation
    remove_column table, :cart_deposit_confirmation
    remove_column table, :food_confirmation
    remove_column table, :experience
    remove_column table, :buddies
    remove_column table, :wildcard
    remove_column table, :private_comments
  end
end
