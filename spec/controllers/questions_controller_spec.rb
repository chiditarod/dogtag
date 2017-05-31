# Copyright (C) 2015 Devin Breen
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

describe QuestionsController do

  context '[logged out]' do
    shared_examples 'redirects to login' do
      it 'redirects to login' do
        endpoint.call
        expect(response).to redirect_to(new_user_session_path)
      end
    end

    describe '#create' do
      let(:endpoint) { lambda { post :create, team_id: 1 }}
      include_examples 'redirects to login'
    end
    describe '#show' do
      let(:endpoint) { lambda { get :show, id: 1, team_id: 1 }}
      include_examples 'redirects to login'
    end
  end

  context '[logged in]' do

    let (:valid_user) { FactoryGirl.create :admin_user }
    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#create' do
      let(:race) { FactoryGirl.create :race_with_jsonform }
      let(:team) { FactoryGirl.create :team, race: race }

      let(:thedata) {{
        'team_id' => team.id,
        'racer-type' => 'Racer'
      }}

      context 'when team is not found' do
        it 'renders 404' do
          post :create, team_id: team.id + 1
          expect(response.status).to eq(404)
        end
      end

      context 'when race is not open for registration' do
        let(:race) { FactoryGirl.create :race_with_jsonform, :registration_closed }

        it 'sets a flash info and redirects to team path' do
          post :create, team_id: team.id
          expect(flash[:error]).to eq(I18n.t('questions.cannot_modify'))
          expect(response.status).to redirect_to(team_path(team))
        end
      end

      {
        'is not on the whitelist' => { 'foo' => 'bar' },
        'has a blank value' => { 'primary-inspiration' => '' }
      }.each do |situation, bad_param|

        context "when a parameter #{situation}" do
          it 'rejects the invalid params' do
            post :create, thedata.merge!(bad_param)
            expect(team.reload.jsonform).to eq({'racer-type' => 'Racer'}.to_json)
          end
        end
      end

      context 'if team save operation fails' do
        let(:thedata) {{
          'team_id' => team.id,
          'racer-type' => 'Racer'
        }}

        before do
          expect(Team).to receive(:find).and_return(team)
          expect(team).to receive(:save).and_return(false)
        end

        it 'logs an error, sets a flash error, and redirects to team questions path' do
          expect(Rails.logger).to receive(:error)
          post :create, thedata
          expect(flash[:error]).to eq(I18n.t('questions.could_not_save'))
          expect(response.status).to redirect_to(team_questions_path(team))
        end
      end

      context 'if team save operation succeeds' do
        let(:thedata) {{
          'team_id' => team.id,
          'racer-type' => 'Racer'
        }}

        it 'sets a flash info and redirects to team path' do
          post :create, thedata
          expect(flash[:info]).to eq(I18n.t('questions.updated'))
          expect(response.status).to redirect_to(team_path(team))
        end
      end
    end

    describe '#show' do
      let(:team) { FactoryGirl.create :team, race: race }

      context 'the team is not found' do
        let(:race) { FactoryGirl.create :race }
        before do
          get :show, team_id: team.id + 1
        end

        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'race has no jsonform data' do
        let(:race) { FactoryGirl.create :race }
        before do
          get :show, team_id: team.id
        end

        it 'sets flash info' do
          expect(flash[:info]).to eq(I18n.t('questions.none_defined'))
        end
        it 'redirects to team#show' do
          expect(response).to redirect_to(team_path(team))
        end
      end

      context 'race has jsonform data' do
        let(:race) { FactoryGirl.create :race_with_jsonform }

        before do
          allow(controller).to receive(:form_authenticity_token).and_return('fake_token')
          get :show, team_id: team.id
        end

        it 'renders 200 and assigns @questions' do
          expect(response.status).to eq(200)
          expect(assigns(:questions)).to_not be_nil
        end
      end
    end
  end
end
