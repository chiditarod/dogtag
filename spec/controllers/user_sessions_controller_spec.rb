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
require 'spec_helper'

describe UserSessionsController do

  context '[logged out]' do
    describe '#destroy' do
      before do
        activate_authlogic
        delete :destroy
      end

      it 'redirects to login' do
        expect(response).to redirect_to("/register/login")
      end

      it 'should not run the user_update_checker' do
        expect(controller.should_run_update_checker).to be_falsey
      end
    end
  end

  context '[logged in]' do
    let(:user) { FactoryBot.create :user }
    before do
      activate_authlogic
      login_user! user
    end

    describe '#destroy' do
      before do
        delete :destroy
      end

      it 'sets flash notice, ends the session and redirects to the SPA' do
        expect(flash[:notice]).to eq(I18n.t 'logout_success')
        expect(response).to redirect_to("/register")
        expect(UserSession.find).to be_nil
      end
    end
  end
end
