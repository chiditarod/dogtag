require 'spec_helper'

describe UsersController do

  let(:valid_user)      { FactoryGirl.create :user }
  let(:valid_user_hash) { FactoryGirl.attributes_for :user }

  context 'when logged out' do

    describe '#index' do
      it 'redirects to login' do
        get :index
        response.should be_redirect
      end
    end
    describe '#show' do
      it 'redirects to login' do
        get :show
        response.should be_redirect
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit
        response.should be_redirect
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update
        response.should be_redirect
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy
        response.should be_redirect
      end
    end

    describe '#new' do
      it 'returns http success and calls User.new' do
        user_stub = User.new
        User.should_receive(:new).and_return user_stub
        get :new
        response.should be_success
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

  context 'when logged in' do
    before do
      activate_authlogic
      mock_login! valid_user
      @user2 = FactoryGirl.create :user, :first_name => 'Mr',
        :last_name => 'Anderson', :email => 'mr@anderson.com'
    end

    describe '#new' do
      it 'returns http success and calls User.new' do
        user_stub = User.new
        User.should_receive(:new).and_return user_stub
        get :new
        response.should be_success
      end
    end

    describe '#index' do
      it 'sets @users to all users' do
        get :index
        response.should be_success
        expect(assigns(:users)).to eq([valid_user, @user2])
      end
    end

    describe '#show' do
      it 'redirects to user index and sets flash error if user id is invalid' do
        get :show, :id => 99
        response.should be_redirect
        flash[:error].should == "User not found."
      end

      it 'sets the user object and returns 200' do
        get :show, :id => @user2.id
        response.should be_success
        assigns(:user).should == @user2
      end
    end

    describe '#edit' do
      it 'redirects to user index and sets flash error if user id is invalid' do
        get :edit, :id => 99
        response.should be_redirect
        flash[:error].should == "User not found."
      end

      it 'sets the user object and returns 200' do
        get :edit, :id => @user2.id
        response.should be_success
        assigns(:user).should == @user2
      end
    end

    describe '#update' do
      it 'returns 400 if the user id is not valid' do
        put :update, :id => 99
        response.status.should == 400
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

      it 'updates the user, sets flash, and redirects' do
        patch :update, :id => @user2.id, :user => {:phone => '123'}
        @user2.reload.phone.should == '123'
        flash[:notice].should == 'User was successfully updated.'
        response.status.should == 302
      end
    end

    describe '#destroy' do
      it 'returns 400 if the user id is not valid' do
        delete :destroy, :id => 99
        response.status.should == 400
      end

      it 'destroys a user, sets flash, and redirects to users index' do
        expect do
          delete :destroy, :id => @user2.id
          flash[:notice].should == 'User deleted.'
          response.should redirect_to users_path
        end.to change(User, :count).by(-1)
      end

      # todo: figure out how to mock the delete failing
      it 'sets flash error and redirects if delete fails'
    end

  end
end
