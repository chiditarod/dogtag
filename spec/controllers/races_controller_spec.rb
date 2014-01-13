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
  end

  context '[logged in]' do
    before do
      activate_authlogic
      user = FactoryGirl.create :user
      mock_login! user
    end

    describe '#show' do
      context 'with invalid id' do
        before { get :show, :id => 100 }

        it 'redirects to race index' do
          expect(response).to redirect_to(races_path)
        end

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'not_found')
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
      end
    end

    describe '#edit' do
      # edit is aliased to show, so no need to spec.
    end

    describe '#update' do
      context 'with invalid id' do
        before { put :update, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
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

      # todo: change this to show races that have visible? checked
      #it 'sets @races to all races open for registration' do
        #expect(assigns :races).to eq [@open1, @open2]
      #end
      it 'sets @races to all races' do
        expect(assigns :races).to eq [@closed, @open1, @open2]
      end
    end

    describe '#new' do
      before do
        @race_stub = Race.new
        Race.should_receive(:new).and_return @race_stub
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @race to Race.new' do
        expect(assigns(:race)).to eq(@race_stub)
      end
    end

      #it 'destroys a race, sets flash, and redirects to races index' do
        #dying_race = FactoryGirl.create :race, :name => "Delete Me"
        #expect do
          #delete :destroy, :id => dying_race.id
          #flash[:notice].should == I18n.t('delete_success')
          #response.should redirect_to races_path
        #end.to change(Race, :count).by(-1)
      #end

      ## todo: figure out how to mock the delete failing
      #it 'sets flash error and redirects if delete fails'
    #end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      #todo - there's probably a way to DRY this up.
      context 'with valid id' do
        before { @race = FactoryGirl.create :race }

        it 'destroys the race' do
          expect { delete :destroy, :id => @race.id }.to change(Race, :count).by(-1)
        end

        it 'sets the flash notice' do
          delete :destroy, :id => @race.id
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to the user index' do
          delete :destroy, :id => @race.id
          expect(response).to redirect_to races_path
        end
      end

      # todo: figure out how to mock the delete failing
      it 'sets flash error and redirects if delete fails'
    end


  end
end
