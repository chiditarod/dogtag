require 'spec_helper'

describe PeopleController do
  let (:valid_person_hash) { FactoryGirl.attributes_for :person }

  before do
    @person = FactoryGirl.create :person, :with_registration
    @registration = @person.registration
    @race = @registration.race
  end

  context '[logged out]' do
    describe '#new' do
      it 'redirects to login' do
        get :new, :race_id => @race.id, :registration_id => @registration.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create, :race_id => @race.id, :registration_id => @registration.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :race_id => @race.id, :registration_id => @registration.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :race_id => @race.id, :registration_id => @registration.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => 1
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
        before { delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      it 'removes a record' do
        expect do
          delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => @person.id
        end.to change(Person, :count).by(-1)
      end

      context 'with valid id' do
        before do
          delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => @person.id
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to registration#show' do
          expect(response).to redirect_to(race_registration_url :race_id => @race.id, :id => @registration.id)
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :race_id => @race.id, :registration_id => @registration.id, :id => 99 }
        it 'returns 400' do
          expect(response.status).to eq(400)
        end
      end

      context 'with valid patch data' do
        before do
          patch :update, :id => @person.id, :race_id => @race.id, :registration_id => @registration.id,
            :person => {:last_name => 'foo'}
        end

        it 'updates the user' do
          expect(@person.reload.last_name).to eq('foo')
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end

        it 'sets @race and @registration (needed by _form.html.haml)' do
          expect(assigns(:race)).to eq(@race)
          expect(assigns(:registration)).to eq(@registration)
        end

        it 'redirects to registration#show' do
          expect(response).to redirect_to(race_registration_url :race_id => @race.id, :id => @registration.id)
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

    describe '#edit' do
      context 'with invalid user id' do
        before do
          get :edit, :race_id => @race.id, :registration_id => @registration.id, :id => 99
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
          get :edit, :race_id => @race.id, :registration_id => @registration.id, :id => @person.id
        end
        it 'sets the @person object' do
          expect(assigns(:person)).to eq(@person)
        end
        it 'returns 200' do
          expect(response).to be_success
        end
      end
    end

    describe '#index' do
      before do
        @person2 = FactoryGirl.create :person2
        @person2.registration = @registration
        @person2.save
        get :index, :race_id => @race.id, :registration_id => @registration.id
      end

      it 'sets @people to all persons' do
        expect(assigns(:people)).to eq([@person, @person2])
      end

      it 'returns http success' do
        expect(response).to be_success
      end
    end

    describe '#new' do
      before do
        @person_stub = Person.new
        Person.should_receive(:new).and_return @person_stub
        get :new, :race_id => @race.id, :registration_id => @registration.id
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @person to Person.new' do
        expect(assigns(:person)).to eq(@person_stub)
      end

      it 'sets @race and @registration (needed by _form.html.haml)' do
        expect(assigns(:race)).to eq(@race)
        expect(assigns(:registration)).to eq(@registration)
      end
    end

    describe '#create' do
      context 'without person param' do
        it 'returns 400' do
          post :create, :race_id => @race.id, :registration_id => @registration.id
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          post :create, :race_id => @race.id, :registration_id => @registration.id, :person => valid_person_hash
        end.to change(Person, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :race_id => @race.id, :registration_id => @registration.id, :person => valid_person_hash
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end

        it 'redirects to registration#show' do
          expect(response).to redirect_to race_registration_url(@race.id, @registration)
        end

        it 'assigns the person to their registration' do
          expect(assigns(:person).registration).to eq(@registration)
        end

      end

      it 'returns 200 and sets flash[:error] when required params are missing' do
        required = [:first_name, :last_name, :email, :phone]
        required.each do |param|
          payload = valid_person_hash.dup
          payload.delete param
          post :create, :race_id => @race.id, :registration_id => @registration.id, :person => payload
          expect(response).to be_success
          expect(flash[:error]).to_not be_nil
          expect(flash[:error].detect { |val| val.is_a? Hash }).to include param
        end
      end
    end

  end
end
