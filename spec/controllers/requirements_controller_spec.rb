require 'spec_helper'

describe RequirementsController do

  before do
    @req = FactoryGirl.create :requirement, :with_race
  end

  context '[logged out]' do
    describe '#new' do
      it 'redirects to login' do
        get :new, :race_id => @req.race.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create, :race_id => @req.race.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :race_id => @req.race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :race_id => @req.race.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  context '[logged in]' do
    before do
      @valid_user = FactoryGirl.create :user
      activate_authlogic
      mock_login! @valid_user
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :race_id => @req.race.id, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      it 'removes a record' do
        expect do
          delete :destroy, :race_id => @req.race.id, :id => @req.id
        end.to change(Requirement, :count).by(-1)
      end

      context 'with valid id' do
        before do
          delete :destroy, :race_id => @req.race.id, :id => @req.id
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to race#show' do
          expect(response).to redirect_to(race_url(@req.race))
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :race_id => @req.race.id, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      context 'with valid patch data' do
        before do
          patch :update, :id => @req.id, :race_id => @req.race.id,
            :requirement => {:name => 'new name'}
        end

        it 'updates the requirement' do
          expect(@req.reload.name).to eq('new name')
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end

        it 'sets @race (needed by _form.html.haml)' do
          expect(assigns(:race)).to eq(@req.race)
        end

        it 'redirects to race#show' do
          expect(response).to redirect_to(race_url :id => @req.race.id)
        end
      end
    end

    describe '#edit' do
      context 'with invalid id' do
        before do
          get :edit, :race_id => @req.race.id, :id => 99
        end
        it 'responds with 400' do
          expect(response.status).to eq(400)
        end

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'not_found')
        end
      end

      context 'with valid user id' do
        before do
          get :edit, :race_id => @req.race.id, :id => @req.id
        end
        it 'sets the @requirement object' do
          expect(assigns(:requirement)).to eq(@req)
        end
        it 'returns 200' do
          expect(response).to be_success
        end
      end
    end

    describe '#new' do
      before do
        @req_stub = Requirement.new
        Requirement.should_receive(:new).and_return @req_stub
        get :new, :race_id => @req.race.id
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @requirement to Requirement.new' do
        expect(assigns(:requirement)).to eq(@req_stub)
      end

      it 'sets @race (needed by _form.html.haml)' do
        expect(assigns(:race)).to eq(@req.race)
      end
    end

    describe '#create' do
      let (:valid_req_hash) { FactoryGirl.attributes_for :requirement2 }

      context 'without valid race' do
        it 'returns 400' do
          post :create, :race_id => 99
          expect(response.status).to eq(400)
        end
      end

      context 'without requirement param' do
        it 'returns 400' do
          post :create, :race_id => @req.race.id
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          post :create, :race_id => @req.race.id, :requirement => valid_req_hash
        end.to change(Requirement, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :race_id => @req.race.id, :requirement => valid_req_hash
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end

        it 'redirects to race#show' do
          expect(response).to redirect_to race_url(@req.race.id)
        end

        it 'assigns the requirement to their race' do
          expect(assigns(:requirement).race).to eq(@req.race)
        end
      end
    end

  end
end
