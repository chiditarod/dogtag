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

describe TeamsController do

  context '[logged out]' do
    shared_examples 'redirects to login' do
      it 'redirects to login' do
        endpoint.call
        expect(response).to redirect_to("/register/login")
      end
    end

    describe '#index' do
      let(:endpoint) { lambda { get :index }}
      include_examples 'redirects to login'
    end
    describe '#new' do
      let(:endpoint) { lambda { get :new }}
      include_examples 'redirects to login'
    end
    describe '#create' do
      let(:endpoint) { lambda { post :create }}
      include_examples 'redirects to login'
    end
    describe '#edit' do
      let(:endpoint) { lambda { get :edit, params: { id: 1 } }}
      include_examples 'redirects to login'
    end
    describe '#update' do
      let(:endpoint) { lambda { patch :update, params: { id: 1 } }}
      include_examples 'redirects to login'
    end
    describe '#show' do
      let(:endpoint) { lambda { get :show, params: { id: 1 } }}
      include_examples 'redirects to login'
    end
    describe '#destroy' do
      let(:endpoint) { lambda { delete :destroy, params: { id: 1 } }}
      include_examples 'redirects to login'
    end
  end

  context '[logged in]' do
    # todo: change unprivileged calls to use normal_user instead of admin_user
    let (:valid_user)     { FactoryBot.create :admin_user }
    let (:admin_user)     { FactoryBot.create :admin_user }
    let (:operator_user)  { FactoryBot.create :admin_user }
    let (:normal_user)    { FactoryBot.create :user } # unused for now ^^

    before do
      activate_authlogic
      login_user! the_user
    end

    describe '#new' do
      let!(:the_user) { valid_user }

      context 'without :race_id param' do
        before { get :new }

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'must_select_race')
        end
        it 'redirects to races index' do
          expect(response).to redirect_to(races_path)
        end
      end

      context 'with :race_id param' do
        let(:team) { Team.new }
        let(:race) { FactoryBot.create :race }

        before do
          allow(Team).to receive(:new).and_return team
          get :new, params: { :race_id => race.id }
        end

        it 'returns http success' do
          expect(response).to be_successful
        end
        it 'assigns team to Team.new' do
          expect(assigns(:team)).to eq(team)
        end
        it 'assigns race' do
          expect(assigns(:race)).to eq(race)
        end
        it 'assigns the race to the team' do
          expect(assigns(:team).race).to eq(race)
        end
      end

      context 'with invalid :race_id param'
    end

    describe '#index' do
      let(:the_user) { valid_user }

      shared_examples 'is_http_success' do
        it 'returns success' do
          expect(response).to be_successful
        end
      end
      shared_examples 'myteams_empty' do
        it 'sets @myteams to empty array' do
          expect(assigns(:myteams)).to be_empty
        end
      end
      shared_examples 'no_race' do
        it "does not assign @race" do
          expect(assigns(:race)).to be_nil
        end
      end

      context 'when user has no teams' do
        let (:valid_team) { FactoryBot.create :team }

        context '[no race_id]' do
          before { get :index }
          include_examples 'no_race'
          include_examples 'myteams_empty'
          include_examples 'is_http_success'
        end

        context '[valid race_id]' do
          before { get :index, params: { :race_id => valid_team.race.id } }

          it 'assigns @race' do
            expect(assigns(:race)).to eq(valid_team.race)
          end
          include_examples 'myteams_empty'
          include_examples 'is_http_success'
        end

        context '[unknown race_id]' do
          before { get :index, params: { :race_id => -1 } }
          it "does not assign @race" do
            expect(assigns(:race)).to be_nil
          end
          include_examples 'myteams_empty'
          include_examples 'is_http_success'
        end
      end

      context 'when user has teams' do
        let (:valid_team) { FactoryBot.create :team, :user => valid_user }
        before do
          valid_team.user = valid_user
          valid_team.save
        end

        context '[no race_id]' do
          before { get :index }
          it "assigns @myteams to the user's teams" do
            expect(assigns(:myteams)).to eq([valid_team])
          end

          it 'sorts newest to oldest' do
            older_team = FactoryBot.create :team, user: valid_user, created_at: 1.day.ago
            newer_team = FactoryBot.create :team, user: valid_user, created_at: Time.zone.now
            get :index
            expect(assigns(:myteams)).to eq([newer_team, valid_team, older_team])
          end

          include_examples 'no_race'
          include_examples 'is_http_success'
        end

        context "[valid race_id]" do

          context "matching user's teams" do
            before do
              get :index, params: { :race_id => valid_team.race.id }
            end
            it "sets race and assigns @myteams to the user's teams for this race" do
              expect(assigns(:race)).to eq(valid_team.race)
              expect(assigns :myteams).to eq([valid_team])
            end

            it 'sorts newest to oldest' do
              race = valid_team.race
              older_team = FactoryBot.create :team, user: valid_user, race: race, created_at: 1.day.ago
              newer_team = FactoryBot.create :team, user: valid_user, race: race, created_at: Time.zone.now
              get :index, params: { :race_id => race.id }
              expect(assigns(:myteams)).to eq([newer_team, valid_team, older_team])
            end

            include_examples 'is_http_success'
          end

          context "not matching user's teams" do
            let(:team_different_race) { FactoryBot.create :team }
            before do
              get :index, params: { :race_id => team_different_race.race.id }
            end
            it 'sets race' do
              expect(assigns(:race)).to eq(team_different_race.race)
            end
            include_examples 'myteams_empty'
            include_examples 'is_http_success'
          end
        end

        context '[unknown race_id]' do
          before { get :index, params: { :race_id => -1 } }
          include_examples 'no_race'
          it "assigns @myteams to the user's teams" do
            expect(assigns(:myteams)).to eq([valid_team])
          end
          include_examples 'is_http_success'
        end
      end
    end

    # Note: jsonform is handled by QuestionsController, not TeamsController

    describe '#edit' do
      # edit is aliased to show, so no need to spec.
    end

    describe "closed registration" do
      let(:closed_race) { FactoryBot.create(:race, :registration_closed) }
      let(:team_hash) { FactoryBot.attributes_for(:team).merge(race_id: closed_race.id) }

      context "as a regular user" do
        let(:the_user) { normal_user }

        it "redirects #new to the race with an error" do
          get :new, params: { race_id: closed_race.id }
          expect(response).to redirect_to(race_path(closed_race))
          expect(flash[:error]).to eq(I18n.t("teams.registration_closed"))
        end

        it "does not create a team" do
          expect do
            post :create, params: { team: team_hash }
          end.not_to change(Team, :count)
          expect(response).to redirect_to(race_path(closed_race))
          expect(flash[:error]).to eq(I18n.t("teams.registration_closed"))
        end
      end

      context "as an operator" do
        let(:the_user) { FactoryBot.create(:operator_user) }

        it "still creates the team" do
          expect do
            post :create, params: { team: team_hash }
          end.to change(Team, :count).by(1)
        end
      end
    end

    describe '#create' do
      let(:the_user) { valid_user }

      let(:race) { FactoryBot.create :race }
      let(:valid_team_hash) do
        _t = FactoryBot.attributes_for :team
        _t.merge(:race_id => race.id)
      end

      context 'without team param' do
        it 'returns 400' do
          post :create
          expect(response.status).to eq(400)
        end
      end

      context 'with valid team parameters' do
        it 'writes a new db record' do
          expect do
            post :create, params: { :team => valid_team_hash }
          end.to change(Team, :count).by 1
        end

        it 'broadcasts when creating the record' do
          expect do
            post :create, params: { :team => valid_team_hash }
          end.to broadcast(:create_team_successful)
        end

        context 'upon success' do
          before do
            post :create, params: { :team => valid_team_hash }
          end

          it 'associates the current user with the new team' do
            expect(assigns(:team).user).to eq(valid_user)
          end
          it 'assigns team' do
            expect(assigns(:team)).to be_present
          end
          it 'sets a flash notice' do
            expect(flash[:notice]).to eq(I18n.t 'create_success')
          end
          it 'redirects to team#questions' do
            expect(response).to redirect_to(team_questions_url(assigns(:team).id))
          end
        end
      end

      context 'with invalid team parameters' do
        before do
          team_stub = double('team', save: false).as_null_object
          allow(Team).to receive(:new).and_return team_stub
          post :create, params: { :team => valid_team_hash }
        end

        it 'returns http success' do
          expect(response).to be_successful
        end
        it 'sets a flash notice' do
          expect(flash.now[:error]).to include(I18n.t 'create_failed')
          expect(flash.now[:error]).to_not be_nil
         end
      end
    end

    describe '#update' do
      let(:the_user) { valid_user }

      context 'on invalid id' do
        before { put :update, params: { :id => -1 } }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'when validation fails on update'

      context "overriding the new team flag" do
        let(:race) { FactoryBot.create :race }
        let(:team) { FactoryBot.create :team, race: race, user: normal_user }

        before { FactoryBot.create :person, team: team, experience: 0 }

        context "as an admin" do
          it "stores the override" do
            patch :update, params: { id: team.id, team: { new_team_setting: "no" } }
            expect(response).to redirect_to(team_url(team.id))
            expect(team.reload).to have_attributes(new_team: false, new_team_overridden: true)
          end
        end

        context "as an operator" do
          let(:the_user) { FactoryBot.create :operator_user }

          it "stores the override" do
            patch :update, params: { id: team.id, team: { new_team_setting: "no" } }
            expect(team.reload).to have_attributes(new_team: false, new_team_overridden: true)
          end
        end

        context "on the edit page" do
          render_views

          def new_team_select
            Nokogiri::HTML(response.body).at_css("select#team_new_team_setting")
          end

          it "offers staff the override, showing the computed value" do
            get :edit, params: { id: team.id }
            expect(new_team_select.css("option").map { |o| [o["value"], o.text] })
              .to eq([["auto", "Automatic (now Yes)"], ["yes", "Yes"], ["no", "No"]])
            expect(new_team_select.at_css("option[selected]")["value"]).to eq("auto")
          end

          it "shows staff the flag on the team page" do
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).to match(/New team:\s+Yes/)
          end

          it "shows staff who the team wants to race with" do
            friend = FactoryBot.create :team, race: team.race, name: "Friendly Folks"
            team.update!(buddy_teams: [friend], other_buddies: "Outsiders")
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).to match(/Racing with:\s+Friendly Folks; Outsiders/)
          end

          it "omits the line when the team has no picks" do
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).not_to include("Racing with")
          end

          it "shows staff the same-route answer, and nothing while it is unanswered" do
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).not_to include("Collaborating")

            team.update!(collaborating: false)
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).to match(/Collaborating:\s+No/)

            team.update!(collaborating: true)
            get :show, params: { id: team.id }
            expect(Nokogiri::HTML(response.body).text).to match(/Collaborating:\s+Yes/)
          end

          it "hides the override from the captain" do
            login_user! normal_user
            get :edit, params: { id: team.id }
            expect(response).to be_successful
            expect(new_team_select).to be_nil
          end
        end

        context "as the team's captain" do
          let(:the_user) { normal_user }

          it "ignores the override" do
            patch :update, params: { id: team.id, team: { description: "Ours", new_team_setting: "no" } }
            expect(team.reload).to have_attributes(description: "Ours", new_team: true, new_team_overridden: nil)
          end
        end
      end

      context 'with valid patch data' do
        let(:team) { FactoryBot.create :team }

        before do
          patch :update, params: { :id => team.id, :team => {:description => 'New Description'} }
        end

        it 'updates the team' do
          expect(team.reload.description).to eq('New Description')
        end

        context 'team has answered questions already' do
          let(:team) { FactoryBot.create :team_with_jsonform }

          it 'sets flash notice and redirects to team#show' do
            expect(response).to redirect_to(team_url(team.id))
            expect(flash[:notice]).to eq(I18n.t 'update_success')
          end
        end

        context 'team has not answered questions and questions exist' do
          let(:race) { FactoryBot.create :race_with_jsonform }
          let(:team) { FactoryBot.create :team, race: race }

          it 'sets flash notice and redirects to team#questions' do
            expect(response).to redirect_to(team_questions_url(team.id))
            expect(flash[:notice]).to eq(I18n.t('teams.update.success_fill_out_questions', raise: true))
            expect(flash[:notice]).not_to match(/translation missing/i)
          end
        end

      end
    end

    describe '#show' do
      let(:the_user) { valid_user }

      context 'using invalid team id' do
        before { get :show, params: { :id => 100 } }

        it 'renders 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'using valid team id' do
        let(:team) { FactoryBot.create :team }

        it 'assigns team, assigns race, returns 200' do
          get :show, params: { :id => team.id }
          expect(assigns(:team)).to eq(team)
          expect(assigns(:race)).to eq(team.race)
          expect(response).to be_successful
        end

        context "with racers and a captain" do
          render_views

          let(:team) { FactoryBot.create :team, :with_people, people_count: 2 }
          let(:the_user) { team.user }
          let(:captain) { team.people.first }
          let(:other) { team.people.last }

          before { team.update!(captain: captain) }

          it "stars the captain and offers Make captain only on the other racers" do
            get :show, params: { :id => team.id }
            page = Nokogiri::HTML(response.body)
            rows = page.css("#people table tr").select { |tr| tr.at_css("> td") }

            captain_row = rows.find { |tr| tr.text.include?(captain.email) }
            other_row = rows.find { |tr| tr.text.include?(other.email) }
            expect(captain_row.css("i.fa-star")).to be_present
            expect(captain_row.css("form.make-captain")).to be_empty
            expect(other_row.css("i.fa-star")).to be_empty
            expect(other_row.at_css("form.make-captain")["action"]).to end_with(team_captain_path(team))
            expect(other_row.at_css("form.make-captain [type=submit]")["aria-label"])
              .to eq("Make #{other.first_name} #{other.last_name} captain")
            expect(captain_row.at_css(".sr-only").text).to eq(I18n.t("people.table.captain"))
            expect(page.at_css("#choose-captain")).to be_nil
          end

          it "asks the owner to choose a captain when there is none" do
            team.update_column(:captain_id, nil)
            get :show, params: { :id => team.id }
            expect(Nokogiri::HTML(response.body).at_css("#choose-captain").text).to eq(I18n.t("teams.show.choose_captain"))
          end

          it "offers no Make captain in the final edit window, while Edit stays" do
            team.race.update_columns(registration_close: 1.day.ago, final_edits_close: 1.day.from_now)
            get :show, params: { :id => team.id }
            page = Nokogiri::HTML(response.body)
            expect(page.css("form.make-captain")).to be_empty
            expect(page.css("#people table i.fa-edit")).to be_present
          end

          context "when staff views the team" do
            let(:the_user) { FactoryBot.create :operator_user }

            it "shows the captain apart from the account holder" do
              get :show, params: { :id => team.id }
              expect(response.body).to include(captain.email)
              expect(response.body).to include(I18n.t("teams.show.account_holder"))

              team.update_column(:captain_id, nil)
              get :show, params: { :id => team.id }
              expect(response.body).to include(I18n.t("teams.show.no_captain"))
            end
          end
        end

        context "with a payment due and racers still missing" do
          render_views

          let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
          let(:team) { FactoryBot.create :team, race: requirement.race }
          let(:the_user) { team.user }
          let(:locked) { I18n.t("requirements.payment_requirement.no_pay_roster") }

          it "tells the captain payment is locked and offers no Stripe button" do
            get :show, params: { :id => team.id }
            expect(response.body).to include(locked)
            expect(response.body).not_to include("stripe-button")
          end

          context "when staff views the team" do
            let(:the_user) { FactoryBot.create :operator_user }

            it "still offers the Stripe button" do
              get :show, params: { :id => team.id }
              expect(response.body).not_to include(locked)
              expect(response.body).to include("stripe-button")
            end
          end

          context "once the roster is full" do
            let(:team) { FactoryBot.create :team, :with_enough_people, race: requirement.race }

            it "offers the Stripe button to the captain" do
              get :show, params: { :id => team.id }
              expect(response.body).not_to include(locked)
              expect(response.body).to include("stripe-button")
            end
          end
        end

        context "with a paid requirement" do
          render_views

          let(:requirement) { FactoryBot.create :payment_requirement_with_tier }
          let(:team) { FactoryBot.create :team, :with_enough_people, race: requirement.race }
          let(:the_user) { team.user }

          def refund_buttons
            Nokogiri::HTML(response.body).css("form[action$='/charges/ch_paid/refund']")
          end

          before do
            requirement.complete(team.id, team.user, "charge_id" => "ch_paid", "amount" => 5000)
            get :show, params: { :id => team.id }
          end

          it "does not show a Refund button to the racer" do
            expect(response.body).to include("50.00")
            expect(refund_buttons).to be_empty
          end

          [:operator_user, :refunder_user].each do |role|
            context "when #{role.to_s.delete_suffix("_user")} views the team" do
              let(:the_user) { FactoryBot.create role }

              it "shows one Refund button" do
                expect(refund_buttons.size).to eq(1)
              end
            end
          end

          context "when an admin views the team" do
            let(:the_user) { FactoryBot.create :admin_user }

            it "also shows refund and invalidate" do
              expect(refund_buttons.size).to eq(2)
            end
          end

          context "once the payment is refunded" do
            let(:the_user) { FactoryBot.create :operator_user }

            before do
              CompletedRequirement.find_by!(charge_id: "ch_paid").update!(refunded_at: Time.current)
              get :show, params: { :id => team.id }
            end

            it "shows Refunded and no buttons" do
              expect(refund_buttons).to be_empty
              expect(Nokogiri::HTML(response.body).css("span.label-primary").map { |node| node.text.strip }).to include("Refunded")
            end
          end
        end

        it 'does not cache this page' do
          get :show, params: { :id => team.id }
          # Rails 7.0: Cache-Control header changed from 'no-cache, no-store' to 'no-store'
          expect(response.headers['Cache-Control']).to eq('no-store')
          expect(response.headers['Pragma']).to eq('no-cache')
        end

        context "if the team is finalized" do
          let(:team) { FactoryBot.create :finalized_team }

          it "does not display finalization banner since user is not the team captain" do
            get :show, params: { :id => team.id }
            expect(assigns(:display_notification)).to be_nil
          end

          context "and is being viewed by the team captain" do
            let(:the_user) { team.user }

            it "displays a banner on the page" do
              get :show, params: { :id => team.id }
              expect(assigns(:display_notification)).to eq(:notify_now_complete)
            end
          end
        end
      end
    end

    describe '#destroy' do
      let(:the_user) { valid_user }

      context 'on invalid id' do
        before { delete :destroy, params: { :id => -1 } }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      it 'destroys the record' do
        team = FactoryBot.create :team
        expect do
          delete :destroy, params: { :id => team.id }
        end.to change(Team, :count).by(-1)
      end

      it 'broadcasts when destroying the record' do
        team = FactoryBot.create :team
        expect do
          delete :destroy, params: { :id => team.id }
        end.to broadcast(:destroy_team_successful)
      end

      context 'as the team captain' do
        let(:the_user) { FactoryBot.create :user }

        it 'deletes their own pending team' do
          team = FactoryBot.create :team, :with_people, people_count: 1, user: the_user
          expect { delete :destroy, params: { id: team.id } }.to change(Team, :count).by(-1).and change(Person, :count).by(-1)
          expect(response).to redirect_to(teams_path)
        end

        it 'cannot delete a team that has paid' do
          team = FactoryBot.create :team, user: the_user
          FactoryBot.create :completed_requirement, team: team, user: the_user
          expect { delete :destroy, params: { id: team.id } }.to raise_error(CanCan::AccessDenied)
          expect(Team.exists?(team.id)).to be(true)
        end
      end

      context 'as an operator' do
        let(:the_user) { FactoryBot.create :operator_user }

        it 'deletes a pending team and returns to the race registrations page' do
          team = FactoryBot.create :team
          expect { delete :destroy, params: { id: team.id } }.to change(Team, :count).by(-1)
          expect(response).to redirect_to(race_registrations_path(team.race))
        end
      end

      context 'with valid id' do
        let(:valid_team) { FactoryBot.create :team }
        before do
          delete :destroy, params: { :id => valid_team.id }
        end

        it 'sets the flash notice and sends staff back to the race registrations' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
          expect(response).to redirect_to(race_registrations_path(valid_team.race))
        end
      end

      context 'when team has made payments' do
        let(:team) { FactoryBot.create :team }
        before do
          FactoryBot.create :completed_requirement, team: team
        end

        it 'does not allow deletion' do
          expect {
            delete :destroy, params: { :id => team.id }
          }.not_to change(Team, :count)
        end

        it 'sets the flash notice' do
          delete :destroy, params: { :id => team.id }
          expect(flash[:error]).to eq(I18n.t('teams.destroy.has_payments'))
        end

        it 'redirects to the team index' do
          delete :destroy, params: { :id => team.id }
          expect(response).to redirect_to(teams_path)
        end
      end
    end
  end
end
