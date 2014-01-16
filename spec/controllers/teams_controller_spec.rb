require 'spec_helper'

describe TeamsController do

  context '[logged out]' do
    describe '#index' do
      it 'redirects to login' do
        get :index; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#new' do
      it 'redirects to login' do
        get :new; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :id => 1; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :id => 1; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :id => 1; expect(response).to redirect_to(new_user_session_path)
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
        it 'sets @race' do
          expect(assigns(:race)).to eq(race_stub)
        end
        it 'sets session[:last_race_id]' do
          expect(session[:last_race_id]).to eq(race_stub.id)
        end
      end

      it 'sets @teams to all teams associated with the current user' do
        valid_team.user = valid_user
        valid_team.save
        not_our_team = FactoryGirl.create :team
        get :index
        expect(assigns(:teams)).to eq([valid_team])
        expect(assigns(:teams)).to_not include not_our_team
      end

      context 'normal query' do
        before { get :index }

        it 'does not set @race object' do
          expect(assigns(:race)).to be_nil
        end
        it 'does not set session[:race_id]' do
          expect(session[:last_race_id]).to be_nil
        end
      end
    end

    describe '#edit' do
      context 'on invalid id' do
        before { get :edit, :id => 99 }

        it 'redirects to team index' do
          expect(response).to redirect_to(teams_path)
        end
        it 'sets flash error' do
          expect(flash[:error]).to eq I18n.t('not_found')
        end
      end

      context 'on success' do
        before { get :edit, :id => valid_team.id }

        it 'assigns the @team object' do
          expect(assigns(:team)).to eq(valid_team)
        end

        it 'returns 200' do
          expect(response.status).to eq(200)
        end
      end
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
          team = FactoryGirl.build :team
          team.user = valid_user
          team_hash = FactoryGirl.attributes_for :team
          post :create, :team => team_hash
          expect(assigns(:team).user).to eq(valid_user)
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

      it 'destroys the team' do
        @team = FactoryGirl.create :team
        expect { delete :destroy, :id => @team.id }.to change(Team, :count).by(-1)
      end

      context 'with valid id' do
        before do
          @team = FactoryGirl.create :team
          delete :destroy, :id => @team.id
        end
        it 'sets the flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end
        it 'redirects to the team index' do
          expect(response).to redirect_to teams_path
        end
      end
    end

  end
end
