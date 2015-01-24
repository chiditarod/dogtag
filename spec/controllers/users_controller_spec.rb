require 'spec_helper'

describe UsersController do

  context '[logged out]' do

    describe '#index' do
      it 'redirects to login' do
        get :index; expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show; expect(response).to redirect_to(new_user_session_path)
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

    describe '#new' do
      before do
        @user_stub = User.new
        User.stub(:new).and_return @user_stub
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
      let(:valid_user_hash) { FactoryGirl.attributes_for :user }

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

      it 'adds a record' do
        expect do
          post :create, :user => valid_user_hash
        end.to change(User, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :user => valid_user_hash
        end
        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success_user')
        end
        it 'redirects to race#show' do
          expect(response).to redirect_to assigns(:user)
        end
      end
    end

  end

  context '[logged in]' do
    let(:valid_user)      { FactoryGirl.create :admin_user }
    before do
      activate_authlogic
      mock_login! valid_user
      @user2 = FactoryGirl.create :user
    end

    describe '#new' do
      before do
        User.stub(:new).and_return @user2
        get :new
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @user to User.new' do
        expect(assigns(:user)).to eq(@user2)
      end
    end

    describe '#index' do
      before { get :index }

      it 'sets @users to all users' do
        expect(assigns(:users)).to_not be_nil
      end

      it 'returns http success' do
        expect(response).to be_success
      end
    end

    describe '#show' do
      context 'with invalid user id' do
        before { get :show, :id => 99 }

        it 'should run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_true
        end

        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid user id' do
        before { get :show, :id => @user2.id }

        it 'should run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_true
        end

        it 'sets the @user object' do
          expect(assigns(:user)).to eq(@user2)
        end
        it 'returns 200' do
          expect(response).to be_success
        end
      end
    end

    describe '#edit' do
      context 'with invalid user id' do
        before { get :edit, :id => 99 }

        it 'should not run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_false
        end

        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid user id' do
        before { get :edit, :id => @user2.id }

        it 'should not run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_false
        end

        it 'sets the @user object' do
          expect(assigns(:user)).to eq(@user2)
        end
        it 'returns 200' do
          expect(response).to be_success
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :id => 99 }

        it 'should not run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_false
        end

        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid patch data' do
        before { patch :update, :id => @user2.id, :user => {:phone => '000-000-0000'} }

        it 'should not run the user_update_checker' do
          expect(controller.should_run_update_checker).to be_false
        end

        it 'updates the user' do
          expect(@user2.reload.phone).to eq('000-000-0000')
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'users.update.update_success')
        end
        it 'redirects to user#show' do
          expect(response).to redirect_to(@user2)
        end
      end
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
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
