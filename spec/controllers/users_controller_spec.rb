require 'spec_helper'

describe UsersController do

  let(:valid_user)      { FactoryGirl.create :user }
  let(:valid_user_hash) { FactoryGirl.attributes_for :user }

  context 'when logged out' do
    describe '#index' do
      it 'redirects to login' do
        get :index; response.should be_redirect
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show; response.should be_redirect
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

    describe '#new' do
      before do
        @user_stub = User.new
        User.should_receive(:new).and_return @user_stub
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @user to User.new' do
        expect(assigns(:user)).to eq(@user_stub)
      end
    end

    describe '#create' do
      it 'returns 400 if the user parameter is not passed' do
        post :create
        response.status.should == 400
      end

      it 'returns 200 and sets flash[:error] when required params are missing' do
        required = [:first_name, :last_name, :email, :phone, :password, :password_confirmation]
        required.each do |param|
          bad_payload = valid_user_hash.dup
          bad_payload.delete param
          post :create, :user => bad_payload
          response.status.should == 200
          flash[:error].detect { |val| val.is_a? Hash }.should include param
        end
      end

      it 'creates a new user and returns 200' do
        expect do
          post :create, :user => valid_user_hash
          response.status.should == 200
        end.to change(User, :count).by 1
      end
    end

  end

  context '[logged in]' do
    before do
      activate_authlogic
      mock_login! valid_user
      @user2 = FactoryGirl.create :user, :first_name => 'Mr',
        :last_name => 'Anderson', :email => 'mr@anderson.com'
    end

    describe '#new' do
      before do
        @user_stub = User.new
        User.should_receive(:new).and_return @user_stub
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @user to User.new' do
        expect(assigns(:user)).to eq(@user_stub)
      end
    end

    describe '#index' do
      before { get :index }

      it 'sets @users to all users' do
        expect(assigns(:users)).to eq([valid_user, @user2])
      end

      it 'returns http success' do
        expect(response).to be_success
      end
    end

    describe '#show' do
      context 'with invalid user id' do
        before { get :show, :id => 99 }

        it 'redirects to user index' do
          expect(response).to redirect_to(users_path)
        end

        it 'sets flash error' do
          expect(flash[:error]).to eq(I18n.t 'not_found')
        end
      end

      context 'with valid user id' do
        before { get :show, :id => @user2.id }

        it 'sets the @user object' do
          expect(assigns(:user)).to eq(@user2)
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
      context 'on invalid id' do
        before { put :update, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      context 'with valid patch data' do
        before { patch :update, :id => @user2.id, :user => {:phone => '123'} }

        it 'updates the user' do
          expect(@user2.reload.phone).to eq('123')
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end

        it 'redirects to race index' do
          expect(response).to redirect_to(users_path)
        end
      end

      # todo - fix this spec
      #it 'sets a flash error and redirects if the user cannot update' do
        #mock_user = double 'User'
        #User.should_receive(:where).and_return mock_user
        #mock_user.should_receive(:update_attributes).and_return(false)
        #patch :update, :id => @user2.id, :user => {:phone => '123'}
        #flash[:error].should include('Update failed.')
        #response.status.should == 302
      #end
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
        it 'destroys the user' do
          expect { delete :destroy, :id => @user2.id }.to change(User, :count).by(-1)
        end

        it 'sets the flash notice' do
          delete :destroy, :id => @user2.id
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to the user index' do
          delete :destroy, :id => @user2.id
          expect(response).to redirect_to users_path
        end

      end

      # todo: figure out how to mock the delete failing
      it 'sets flash error and redirects if delete fails'
    end

  end
end
