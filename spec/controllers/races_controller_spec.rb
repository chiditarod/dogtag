require 'spec_helper'

describe RacesController do

  context '[logged out]' do
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
    describe '#export' do
      it 'redirects to login' do
        get :export, :race_id => 1; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#registrations' do
      it 'redirects to login' do
        get :registrations, :race_id => 1; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#show'
  end

  context '[logged in]' do
    before do
      activate_authlogic
      user = FactoryGirl.create :admin_user
      mock_login! user
    end

    describe '#registrations' do

      shared_examples "empty_finalized_teams" do
        it "assigns finalized_teams to []" do
          expect(assigns :finalized_teams).to be_empty
        end
      end
      shared_examples "empty_waitlisted_teams" do
        it "assigns waitlisted_teams to []" do
          expect(assigns :waitlisted_teams).to be_empty
        end
      end

      context 'with invalid race_id' do
        before { get :registrations, :race_id => 100 }
        it 'sets 404' do
          expect(response.status).to eq(404)
        end
      end

      context "with no teams" do
        let(:race) { FactoryGirl.create :race }
        before { get :registrations, :race_id => race.id }

        include_examples 'empty_finalized_teams'
        include_examples 'empty_waitlisted_teams'
      end

      context "with a finalized team" do
        let(:team) { FactoryGirl.create :finalized_team }
        before { get :registrations, :race_id => team.race.id }

        it 'assigns finalized_teams' do
          expect(assigns :finalized_teams).to eq([team])
        end
        include_examples 'empty_waitlisted_teams'
      end

      context "with a non-finalized team" do
        let(:team) { FactoryGirl.create :team }
        before { get :registrations, :race_id => team.race.id }

        it 'assigns waitlisted_teams' do
          expect(assigns :waitlisted_teams).to eq([team])
        end
        include_examples 'empty_finalized_teams'
      end
    end

    describe '#export' do
      context 'with invalid id' do
        before { get :export, :race_id => 100 }
        it 'sets 404' do
          expect(response.status).to eq(404)
        end
        it 'sends only finalized data when params[:finalized] is present'
        it 'sends finalized and non-finalized registrations by default'
        it 'sends CSV data'
        it 'sets headers correctly'
      end

      context 'with valid id' do
        before do
          @team = FactoryGirl.create :finalized_team
          get :show, :id => @team.race.id
        end

        it 'returns 200' do
          expect(response).to be_success
        end
        it 'sends CSV data'
        it 'handles the finalized param'
      end
    end

    describe '#show' do
      context 'with invalid id' do
        before { get :show, :id => 100 }
        it 'sets 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid id' do
        before do
          @race = FactoryGirl.create :race
          get :show, :id => @race.id
        end
        it 'sets the @race object' do
          expect(assigns(:race)).to eq(@race)
        end
        it 'returns 200' do
          expect(response).to be_success
        end
        it "sets @my_race_teams to the user's teams for this race"
      end
    end

    describe '#edit' do
      # edit is aliased to show, so no need to spec.
    end

    describe '#update' do
      context 'with invalid id' do
        before { put :update, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid patch data' do
        before do
          @race = FactoryGirl.create :race
          patch :update, :id => @race.id, :race => {:max_teams => 200}
        end
        it 'updates the race' do
          expect(@race.reload.max_teams).to eq(200)
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end
        it 'redirects to race#show' do
          expect(response).to redirect_to(race_url @race.id)
        end
      end
    end

    describe '#create' do
      let (:valid_race_hash) { FactoryGirl.attributes_for :race }

      it 'returns 400 if the race parameter is not passed' do
        post :create
        response.status.should == 400
      end

      it 'returns 200 and sets flash[:error] when required params are missing' do
        required = [:name, :race_datetime, :max_teams, :people_per_team, :registration_open, :registration_close]
        required.each do |param|
          bad_payload = valid_race_hash.dup
          bad_payload.delete param
          post :create, :race => bad_payload
          response.status.should == 200
          flash[:error].should_not be_nil
          flash[:error].detect { |val| val.is_a? Hash }.should include param
        end
      end

      it 'adds a record' do
        expect do
          post :create, :race => valid_race_hash
        end.to change(Race, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :race => valid_race_hash
        end
        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end
        it 'redirects to races index' do
          expect(response).to redirect_to races_path
        end
      end
    end

    describe '#index' do
      before do
        @closed = FactoryGirl.create :closed_race
        @open1 = FactoryGirl.create :race
        @open2 = FactoryGirl.create :race
        get :index
      end

      it 'returns http success' do
        expect(response).to be_success
      end
      it 'sets @races to all races' do
        expect(assigns(:races).count).to eq 3
      end
    end

    describe '#new' do
      before do
        @race_stub = Race.new
        Race.stub(:new).and_return @race_stub
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end
      it 'assigns @race to Race.new' do
        expect(assigns(:race)).to eq(@race_stub)
      end
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'on valid id' do
        before do
          @race = FactoryGirl.create :race
        end

        it 'destroys the race' do
          expect { delete :destroy, :id => @race.id }.to change(Race, :count).by(-1)
        end

        context 'with valid id' do
          before do
            delete :destroy, :id => @race.id
          end

          it 'sets the flash notice' do
            expect(flash[:notice]).to eq(I18n.t 'delete_success')
          end
          it 'redirects to the user index' do
            expect(response).to redirect_to races_path
          end
        end
      end
    end

  end
end
