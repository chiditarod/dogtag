# Copyright (C) 2013 Devin Breen
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
class AddAuthToUsers < ActiveRecord::Migration

  def self.up
      # START authlogic
      add_column :users, :email, :string,                :null => false, :default => ''    # optional, you can use login instead, or both
      add_column :users, :crypted_password, :string,     :null => false, :default => ''    # optional, see below
      add_column :users, :password_salt, :string,        :null => false, :default => ''    # optional, but highly recommended
      add_column :users, :persistence_token, :string,    :null => false, :default => ''    # required
      add_column :users, :single_access_token, :string,  :null => false, :default => ''    # optional, see Authlogic::Session::Params
      add_column :users, :perishable_token, :string,     :null => false, :default => ''    # optional, see Authlogic::Session::Perishability

      # Magic columns, just like ActiveRecord's created_at and updated_at. These are automatically maintained by Authlogic if they are present.
      add_column :users, :login_count,  :integer,          :null => false, :default => 0    # optional, see Authlogic::Session::MagicColumns
      add_column :users, :failed_login_count, :integer,    :null => false, :default => 0    # optional, see Authlogic::Session::MagicColumns
      add_column :users, :last_request_at, :datetime                                         # optional, see Authlogic::Session::MagicColumns
      add_column :users, :current_login_at, :datetime                                        # optional, see Authlogic::Session::MagicColumns
      add_column :users, :last_login_at, :datetime                                           # optional, see Authlogic::Session::MagicColumns
      add_column :users, :current_login_ip, :string                                        # optional, see Authlogic::Session::MagicColumns
      add_column :users, :last_login_ip, :string                                           # optional, see Authlogic::Session::MagicColumns
      # END authlogic
  end

  def self.down
    remove_column :users, :email
    remove_column :users, :crypted_password
    remove_column :users, :password_salt
    remove_column :users, :persistence_token
    remove_column :users, :single_access_token
    remove_column :users, :perishable_token
    remove_column :users, :login_count
    remove_column :users, :failed_login_count
    remove_column :users, :last_request_at
    remove_column :users, :current_login_at
    remove_column :users, :last_login_at
    remove_column :users, :current_login_ip
    remove_column :users, :last_login_ip
  end
end
