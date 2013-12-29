require 'spec_helper'

describe TeamsController do

  context '[logged out]' do
    describe '#index' do
      it 'redirects to login' do
        get :index; response.should be_redirect
      end
    end
    describe '#new' do
      it 'redirects to login' do
        get :new; response.should be_redirect
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create; response.should be_redirect
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show, :id => 1; response.should be_redirect
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :id => 1; response.should be_redirect
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :id => 1; response.should be_redirect
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :id => 1; response.should be_redirect
      end
    end
  end

  context '[logged in]' do
    let (:valid_team) { FactoryGirl.create :team }
    let (:valid_team_hash) { FactoryGirl.attributes_for :team }
    let (:valid_user) { FactoryGirl.create :user }

    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#new' do
      before do
        @team_stub = Team.new
        Team.should_receive(:new).and_return @team_stub
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @team to Team.new' do
        expect(assigns(:team)).to eq(@team_stub)
      end
    end

    describe '#index' do
      let (:race_stub) { FactoryGirl.build :race }

      context 'with race_id param' do
        before do
          Race.should_receive(:find).and_return race_stub
          get :index, :race_id => '69'
        end

        it 'sets session[:race_id]' do
          expect(session[:race_id]).to eq('69')
        end
      end

      context 'with session[:race_id]' do
        before do
          Race.should_receive(:find).and_return race_stub
          session[:race_id] = '69'
          get :index
        end

        it 'sets @race' do
          expect(assigns(:race)).to eq(race_stub)
        end

        it 'sets @teams to all teams associated with the current user' do
          # need to create a new team since we already create one above
          some_other_team = FactoryGirl.create :team, :name => 'other team'
          valid_team.users << valid_user
          expect(assigns(:teams)).to eq([valid_team])
          expect(assigns(:teams)).to_not include some_other_team
        end
      end

      context 'without race_id param' do
        before { get :index }

        it 'sets flash error' do
          expect(flash[:error]).to eq I18n.t('must_select_race')
        end

        it 'redirects to races index' do
          expect(response).to redirect_to(races_path)
        end
      end
    end

    describe '#show' do
      context 'on invalid id' do
        before { get :show, :id => 99 }

        it 'redirects to team index' do
          expect(response).to be_redirect
        end
        it 'sets flash error' do
          expect(flash[:error]).to eq I18n.t('not_found')
        end
      end

      context 'on success' do
        before { get :show, :id => valid_team.id }

        it 'assigns the @team object' do
          expect(assigns(:team)).to eq(valid_team)
        end

        it 'returns 200' do
          expect(response.status).to eq(200)
        end
      end
    end

    describe '#edit' do
      # edit is aliased to show, so no need to spec.
    end

    describe '#create' do
      context 'without team param' do
        it 'returns 400' do
          post :create
          expect(response.status).to eq(400)
        end
      end

      context 'with team param' do
        it 'creates a new team' do
          expect do
            post :create, :team => valid_team_hash
          end.to change(Team, :count).by 1
        end

        it 'redirects to team index' do
          post :create, :team => valid_team_hash
          expect(response).to redirect_to(teams_path)
        end

        it 'associates the current user with the new team' do
          team = FactoryGirl.build :team, :name => 'some team'
          team.users << valid_user
          team_hash = FactoryGirl.attributes_for :team, :name => 'some team'
          post :create, :team => team_hash
          expect(assigns(:team).users).to eq([valid_user])
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      context 'with valid patch data' do
        before { patch :update, :id => valid_team.id, :team => {:name => 'foo'} }

        it 'updates the team' do
          expect(valid_team.reload.name).to eq('foo')
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end

        it 'redirects to team index' do
          expect(response).to redirect_to(teams_path)
        end
      end
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      #todo - there's probably a way to DRY this up.
      context 'with valid id' do
        before { @team = FactoryGirl.create :team, :name => 'some team' }

        it 'destroys the team' do
          expect { delete :destroy, :id => @team.id }.to change(Team, :count).by(-1)
        end

        it 'sets the flash notice' do
          delete :destroy, :id => @team.id
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to the team index' do
          delete :destroy, :id => @team.id
          expect(response).to redirect_to teams_path
        end
      end

      # todo: figure out how to mock the delete failing
      it 'sets flash error and redirects if delete fails'
    end

  end
end
