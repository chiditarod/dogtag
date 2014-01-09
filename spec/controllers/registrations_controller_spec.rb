require 'spec_helper'

describe RegistrationsController do
  let (:valid_registration_hash) { FactoryGirl.attributes_for :registration }

  before do
    @race = FactoryGirl.create :race
    @team = FactoryGirl.create :team
  end

  context '[logged out]' do
    describe '#new' do
      it 'redirects to login' do
        get :new, :race_id => @race.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create, :race_id => @race.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :race_id => @race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :race_id => @race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :race_id => @race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show, :race_id => @race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#index' do
      it 'redirects to login' do
        get :index, :race_id => @race.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  context '[logged in]' do
    let(:valid_user) { FactoryGirl.create :user }
    before do
      activate_authlogic
      mock_login! valid_user
    end

    describe '#new' do
      let (:race_stub) { FactoryGirl.build :race }

      context 'without params[:team_id]' do
        before { get :new, :race_id => @race.id }

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'must_select_team')
        end

        it 'redirects to teams index' do
          expect(response).to redirect_to(teams_path)
        end
      end

      context 'with params[:team_id]' do
        before do
          @registration_stub = Registration.new
          Registration.should_receive(:new).and_return @registration_stub
          Race.should_receive(:find).and_return @race
          Team.should_receive(:find).and_return @team
          get :new, :race_id => @race.id, :team_id => @team.id
        end

        it 'sets session[:team_id]' do
          expect(session[:team_id].to_i).to eq(@team.id)
        end

        it 'returns http success' do
          expect(response).to be_success
        end

        it 'assigns @race' do
          expect(assigns(:race)).to eq(@race)
        end

        it 'assigns @registration to Registration.new' do
          expect(assigns(:registration)).to eq(@registration_stub)
        end

        it 'sets a default team name' do
          expect(assigns(:registration).name).to eq(@team.name)
        end
      end
    end

    describe '#create' do

      context 'without registration param' do
        it 'returns 400' do
          post :create, :race_id => @race.id
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          session[:team_id] = @team.id
          post :create, :race_id => @race.id, :registration => valid_registration_hash
        end.to change(Registration, :count).by 1
      end

      context 'upon success' do
        before do
          Race.should_receive(:find).and_return @race
          Team.should_receive(:find).and_return @team
          session[:team_id] = @team.id
          post :create, :race_id => @race.id, :registration => valid_registration_hash
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end

        it 'redirects to registration#show' do
          reg = assigns(:registration)
          expect(response).to redirect_to(race_registration_url(reg.race.id, reg.id))
        end

        it 'assigns the team to the registration' do
          expect(assigns(:registration).team).to eq(@team)
        end

        it 'assigns the race to the registration' do
          expect(assigns(:registration).race).to eq(@race)
        end
      end

      it 'returns 200 and sets flash[:error] when required params are missing' do
        session[:team_id] = @team.id
        required = [:name]
        required.each do |param|
          payload = valid_registration_hash.dup
          payload.delete param
          post :create, :race_id => @race.id, :registration => payload
          expect(response).to be_success
          expect(flash[:error]).to_not be_nil
          expect(flash[:error].detect { |val| val.is_a? Hash }).to include param
        end
      end
    end

    describe '#edit' do
      # edit is aliased to show, so no need to spec.
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :race_id => @race.id, :id => 100 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      context 'with valid patch data' do
        before do
          @registration = FactoryGirl.create :registration, :complete
          patch :update, :race_id => @registration.race.id, :id => @registration.id,
            :registration => {:description => 'New Description'}
        end

        it 'updates the registration' do
          expect(@registration.reload.description).to eq('New Description')
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end

        it 'redirects to registration#show' do
          expect(response).to redirect_to(race_registration_url(@registration.race.id, @registration.id))
        end
      end
    end

    describe '#show' do
      context 'invalid id' do
        before { get :show, :race_id => @race.id, :id => 100 }

        it 'redirects to teams index' do
          expect(response).to redirect_to(teams_path)
        end

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'not_found')
        end
      end

      context 'with valid id' do
        before do
          @registration = FactoryGirl.create :registration, :complete
          get :show, :race_id => @registration.race.id, :id => @registration.id
        end

        it 'sets the @registration object' do
          expect(assigns(:registration)).to eq(@registration)
        end

        it 'returns 200' do
          expect(response).to be_success
        end

        it 'assigns @race' do
          expect(assigns(:race)).to eq(@registration.race)
        end

      end
    end

  # todo: not yet customized for this class
    #describe '#index' do
      #it 'returns http success and an array of all races open for registration' do
        #today = Time.now
        #double(Time.now) { today }
        #FactoryGirl.create :race, :name => 'closed race, its today!'
        #open_race1 = FactoryGirl.create :race, :name => 'open race 1', :race_datetime => (today + 4.weeks), :registration_open => (today - 2.weeks), :registration_close => (today + 2.weeks)
        #open_race2 = FactoryGirl.create :race, :name => 'open race 2', :race_datetime => (today + 6.weeks), :registration_open =>(today - 1.week), :registration_close => (today + 1.day)
        #get :index
        #response.should be_success
        #expect(assigns :races).to eq [open_race1, open_race2]
      #end
    #end

    #describe '#destroy' do
      #context 'on invalid id' do
        #before { delete :destroy, :id => 99 }
        #it 'returns 400' do
          #expect(response.status).to eq(400)
        #end
      #end

      #todo - there's probably a way to DRY this up.
      #context 'with valid id' do
        #before { @race = FactoryGirl.create :race }

        #it 'destroys the race' do
          #expect { delete :destroy, :id => @race.id }.to change(Race, :count).by(-1)
        #end

        #it 'sets the flash notice' do
          #delete :destroy, :id => @race.id
          #expect(flash[:notice]).to eq(I18n.t 'delete_success')
        #end

        #it 'redirects to the user index' do
          #delete :destroy, :id => @race.id
          #expect(response).to redirect_to races_path
        #end
      #end

      # todo: figure out how to mock the delete failing
      #it 'sets flash error and redirects if delete fails'
    #end


  end
end
