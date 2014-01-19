require 'spec_helper'

describe PeopleController do


  before do
    @registration = FactoryGirl.create :registration_with_people
    @person = @registration.people.first
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
      @valid_user = FactoryGirl.create :admin_user
      activate_authlogic
      mock_login! @valid_user
    end

    describe '#destroy' do
      context 'on invalid id' do
        before { delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      it 'removes a record' do
        expect do
          delete :destroy, :race_id => @race.id, :registration_id => @registration.id, :id => @person.id
        end.to change(Person, :count).by(-1)
      end

      # we don't want to remove a person record once we reach the correct number, as
      # it would cause the registration to no longer be complete
      context 'when registration requirements are all met' do
        it 'does not destroy the record'
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
        it 'returns 404' do
          expect(response.status).to eq(404)
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
    end

    describe '#edit' do
      context 'with invalid user id' do
        before do
          get :edit, :race_id => @race.id, :registration_id => @registration.id, :id => 99
        end
        it 'responds with 404' do
          expect(response.status).to eq(404)
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

    describe '#new' do
      before do
        @person_stub = Person.new
        Person.stub(:new).and_return @person_stub
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

      let (:reg_no_people) { FactoryGirl.create :registration }
      let (:new_person_hash) { FactoryGirl.attributes_for :person, :first_name => 'Dan', :last_name => 'Akroyd' }

      context 'without person param' do
        it 'returns 400' do
          post :create, :race_id => @race.id, :registration_id => reg_no_people.id
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          post :create, :race_id => @race.id, :registration_id => reg_no_people.id, :person => new_person_hash
        end.to change(Person, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :race_id => @race.id, :registration_id => reg_no_people.id, :person => new_person_hash
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end

        it 'redirects to registration#show' do
          expect(response).to redirect_to race_registration_url(@race.id, reg_no_people.id)
        end

        it 'assigns the person to their registration' do
          expect(assigns(:person).registration).to eq(reg_no_people)
        end

      end

      it 'returns 200 and sets flash[:error] when required params are missing' do
        required = [:first_name, :last_name, :email, :phone]
        required.each do |param|
          payload = new_person_hash.dup
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