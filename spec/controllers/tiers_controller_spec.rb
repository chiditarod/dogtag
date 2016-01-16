require 'spec_helper'

describe TiersController do


  context '[logged out]' do
    describe '#new' do
      it 'redirects to login' do
        get :new
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :id => -1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :id => -1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  context '[logged in]' do

    # Todo: move to let
    before do
      @req = FactoryGirl.create :payment_requirement
      @tier = FactoryGirl.create :tier
      @req.tiers << @tier
    end

    let (:valid_tier_hash) { FactoryGirl.attributes_for :tier2 }

    before do
      @valid_user = FactoryGirl.create :admin_user
      activate_authlogic
      mock_login! @valid_user
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      it 'removes a record' do
        expect do
          delete :destroy, :id => @tier.id
        end.to change(Tier, :count).by(-1)
      end

      context 'with valid id' do
        before do
          delete :destroy, :id => @tier.id
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end
        it 'redirects to race#edit' do
          expect(response).to redirect_to(edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id)
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid patch data' do
        before do
          patch :update, :id => @tier.id, :tier => {:price => '88800'}
        end
        it 'updates the requirement' do
          expect(@tier.reload.price).to eq(88800)
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end
        it 'redirects to race_requirement#edit' do
          expect(response).to redirect_to(edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id)
        end
      end
    end

    describe '#edit' do
      context 'with invalid id' do
        before do
          get :edit, :id => -1
        end
        it 'responds with 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid id' do
        before do
          get :edit, :id => @tier.id
        end
        it 'sets @requirement and @tier objects, returns 200' do
          expect(assigns(:tier)).to eq(@tier)
          expect(assigns(:requirement)).to eq(@tier.requirement)
          expect(response.status).to eq(200)
        end
      end
    end

    describe '#new' do
      context 'without requirement_id param' do
        it 'returns 400' do
          post :create, :tier => valid_tier_hash
          expect(response.status).to eq(400)
        end
      end

      context 'upon success' do
        before do
          @tier_stub = Tier.new
          allow(Tier).to receive(:new).and_return @tier_stub
          get :new, :requirement_id => @req.id
        end

        it 'returns http success' do
          expect(response).to be_success
        end
        it 'assigns @tier to Tier.new' do
          expect(assigns(:tier)).to eq(@tier_stub)
        end
      end
    end

    describe '#create' do

      context 'without valid tier param' do
        it 'returns 400' do
          post :create
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          post :create, :tier => valid_tier_hash.merge(:requirement_id => @req.id)
        end.to change(Tier, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :tier => valid_tier_hash.merge(:requirement_id => @req.id)
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end
        it 'redirects to race_requirement#edit' do
          expect(response).to redirect_to(edit_race_requirement_url :race_id => @tier.requirement.race.id, :id => @tier.requirement.id)
        end
        it 'assigns the tier to the requirement' do
          expect(assigns(:tier).requirement).to eq(@req)
        end
        it 'sets @requirement' do
          expect(assigns(:requirement)).to eq(@tier.requirement)
        end
      end
    end

  end
end
