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
require "spec_helper"

describe ApplicationController do
  controller do
    def index
      raise ActionController::BadRequest, "Invalid encoding for parameter"
    end
  end

  describe "rescue_from ActionController::BadRequest" do
    it "returns 400 status" do
      get :index
      expect(response).to have_http_status(:bad_request)
    end

    it "renders the 400 template" do
      get :index
      expect(response).to render_template("error/400")
    end
  end

  describe "require_user" do
    controller do
      before_action :require_user

      def index
        head :ok
      end
    end

    it "sends a logged-out request to the SPA login" do
      activate_authlogic
      get :index

      expect(response).to redirect_to("/register/login")
      expect(flash[:notice]).to be_nil
    end

    it "sends a user whose record is invalid to the SPA account page" do
      activate_authlogic
      user = FactoryBot.create(:user)
      user.update_column(:phone, nil)
      login_user!(user)
      get :index

      expect(response).to redirect_to("/register/account")
      expect(flash[:notice]).to be_nil
    end
  end
end
