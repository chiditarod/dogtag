require 'spec_helper'

describe UsersController do

  let(:user) { FactoryGirl.create :user }
  let (:user_hash)  { FactoryGirl.attributes_for :user }

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
        get :edit; response.should be_redirect
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update; response.should be_redirect
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy; response.should be_redirect
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
          bad_payload = user_hash.dup
          bad_payload.delete param
          post :create, :user => bad_payload
          response.status.should == 200
          flash[:error].should_not be_nil
          flash[:error].detect { |val| val.is_a? Hash }.should include param
        end
      end

      it 'creates a new user and returns 200' do
        expect do
          post :create, :user => user_hash
          response.status.should == 200
        end.to change(User, :count).by 1
      end
    end

  end

  context 'when logged in' do
    before do
      activate_authlogic
      mock_login! user
      @user2 = FactoryGirl.create :user, :first_name => 'Mr', :last_name => 'Anderson', :email => 'mr@anderson.com'
    end

    describe '#index' do
      it 'sets @users to all users' do
        get :index
        response.should be_success
        expect(assigns(:users)).to eq([user, @user2])
      end
    end

    describe '#show' do
      it 'redirects to the user index and sets flash error if a user is not found' do
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

    describe '#update' do
      it 'returns 400 if the user id is not valid' do
        put :update, :id => 99
        response.status.should == 400
      end

      it 'updates the user and redirects to the user edit page' do
        user3 = FactoryGirl.create :user, :first_name => 'Joe', :email => 'joe@example.com'
        patch :update, :id => user3.id, :user => {:phone => "123"}
        response.status.should == 302
        user3.reload.phone.should == "123"
      end
    end

    describe '#destroy' do
      it 'returns 400 if the user id is not valid' do
        put :update, :id => 99
        response.status.should == 400
      end

      # todo - this test is broken, freezes things up
      #it 'destroys a particular user and redirects' do
        #user3 = FactoryGirl.create :user, :first_name => 'Joe', :email => 'joe@example.com'
        #expect do
          #delete :destroy, :id => user3.id
          #response.should == 302
        #end.to change(User, :count).by 1
      #end
      
    end

  end
end
