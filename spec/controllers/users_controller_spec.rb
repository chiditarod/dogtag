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

describe UsersController do

  context '[logged out]' do
    describe '#index' do
      it 'redirects to login' do
        get :index; expect(response).to redirect_to("/register/login")
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, params: { :id => 1 }; expect(response).to redirect_to("/register/login")
      end
    end
  end

  context '[logged in]' do
    let(:valid_user) { FactoryBot.create :admin_user }
    let(:some_user)  { FactoryBot.create :user }

    before do
      activate_authlogic
      login_user! valid_user
    end

    describe '#index' do

      it 'sets @users to all users and returns http success' do
        get :index
        expect(assigns(:users)).to_not be_nil
        expect(response).to be_successful
      end

      it 'runs the user_update_checker' do
        get :index
        expect(controller.should_run_update_checker).to be true
      end
    end

    describe '#destroy' do

      context 'on invalid id' do

        it 'returns 404' do
          delete :destroy, params: { :id => -1 }
          expect(response.status).to eq(404)
        end
      end

      #todo - there's probably a way to DRY this up.
      context 'with valid id' do

        it 'destroys the user' do
          some_user = FactoryBot.create :user
          expect do
            delete :destroy, params: { :id => some_user.id }
          end.to change(User, :count).by(-1)
        end

        it 'sets the flash notice and redirects to the user index' do
          delete :destroy, params: { :id => some_user.id }
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
          expect(response).to redirect_to users_path
        end
      end

      it 'refuses to delete a staff user who made refund batches, with a message instead of a 500' do
        staff = FactoryBot.create :refunder_user
        FactoryBot.create :refund_batch, user: staff

        expect { delete :destroy, params: { :id => staff.id } }.not_to change(User, :count)

        expect(flash[:error]).to eq('Made refunds, which are kept as a record.')
        expect(response).to redirect_to users_path
      end

      it 'refuses to delete a staff user who made a single refund outside any batch' do
        staff = FactoryBot.create :refunder_user
        FactoryBot.create :completed_requirement, refunded_by: staff, refunded_at: Time.current

        expect { delete :destroy, params: { :id => staff.id } }.not_to change(User, :count)

        expect(flash[:error]).to eq('Made refunds, which are kept as a record.')
        expect(response).to redirect_to users_path
      end

      it 'refuses to delete a user who owns a team' do
        owner = FactoryBot.create(:team).user

        expect { delete :destroy, params: { :id => owner.id } }.not_to change(User, :count)

        expect(flash[:error]).to eq('Owns 1 team. Delete or reassign them first.')
        expect(response).to redirect_to users_path
      end

      it 'sets flash error and redirects if delete fails' do
        user = FactoryBot.create :user
        allow_any_instance_of(User).to receive(:destroy).and_return(false)
        delete :destroy, params: { :id => user.id }
        expect(flash[:error]).to eq(I18n.t 'destroy_failed')
        expect(response).to redirect_to users_path
      end
    end
  end
end
