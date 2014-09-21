require 'spec_helper'

describe PeopleController do

  before do
    @team = FactoryGirl.create :team, :with_people
    @person = @team.people.first
  end

  context '[logged out]' do
    describe '#new' do
      it 'redirects to login' do
        get :new, :team_id => @team.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#create' do
      it 'redirects to login' do
        post :create, :team_id => @team.id
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#edit' do
      it 'redirects to login' do
        get :edit, :team_id => @team.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#update' do
      it 'redirects to login' do
        patch :update, :team_id => @team.id, :id => 1
        expect(response).to redirect_to(new_user_session_path)
      end
    end
    describe '#destroy' do
      it 'redirects to login' do
        delete :destroy, :team_id => @team.id, :id => 1
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
        before { delete :destroy, :team_id => @team.id, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      it 'removes a record' do
        expect do
          delete :destroy, :team_id => @team.id, :id => @person.id
        end.to change(Person, :count).by(-1)
      end

      # we don't want to remove a person record once we reach the correct number, as
      # it would cause the team to no longer be complete
      context 'when team requirements are all met' do
        it 'does not destroy the record'
      end

      context 'with valid id' do
        before do
          delete :destroy, :team_id => @team.id, :id => @person.id
        end

        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'delete_success')
        end

        it 'redirects to team#show' do
          expect(response).to redirect_to(team_url :id => @team.id)
        end
      end
    end

    describe '#update' do
      context 'on invalid id' do
        before { put :update, :team_id => @team.id, :id => 99 }
        it 'returns 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid patch data' do
        before do
          patch :update, :id => @person.id, :team_id => @team.id,
            :person => {:last_name => 'foo'}
        end
        it 'updates the user' do
          expect(@person.reload.last_name).to eq('foo')
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'update_success')
        end
        it 'sets @team (needed by _form.html.haml)' do
          expect(assigns(:team)).to eq(@team)
        end
        it 'redirects to team#show' do
          expect(response).to redirect_to(team_url :id => @team.id)
        end
      end
    end

    describe '#edit' do
      context 'with invalid user id' do
        before do
          get :edit, :team_id => @team.id, :id => 99
        end
        it 'responds with 404' do
          expect(response.status).to eq(404)
        end
      end

      context 'with valid user id' do
        before do
          get :edit, :team_id => @team.id, :id => @person.id
        end
        it 'assigns person' do
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
        get :new, :team_id => @team.id
      end

      it 'returns http success' do
        expect(response).to be_success
      end

      it 'assigns @person to Person.new' do
        expect(assigns(:person)).to eq(@person_stub)
      end

      it 'sets @team (needed by _form.html.haml)' do
        expect(assigns(:team)).to eq(@team)
      end
    end

    describe '#create' do
      let (:team_no_people) { FactoryGirl.create :team }
      let (:new_person_hash) { FactoryGirl.attributes_for :person, :first_name => 'Dan', :last_name => 'Akroyd' }

      context 'without person param' do
        it 'returns 400' do
          post :create, :team_id => team_no_people.id
          expect(response.status).to eq(400)
        end
      end

      it 'adds a record' do
        expect do
          post :create, :team_id => team_no_people.id, :person => new_person_hash
        end.to change(Person, :count).by 1
      end

      context 'upon success' do
        before do
          post :create, :team_id => team_no_people.id, :person => new_person_hash
        end

        it 'sets a flash notice' do
          expect(flash[:notice]).to eq(I18n.t 'create_success')
        end

        it 'redirects to team#show' do
          expect(response).to redirect_to team_url(team_no_people.id)
        end

        it 'assigns the person to their team' do
          expect(assigns(:person).team).to eq(team_no_people)
        end
      end

      context "when person object is invalid" do
        before do
          @person_stub = Person.new
          Person.stub(:new).and_return @person_stub
          expect(@person_stub).to receive(:valid?).and_return false
          post :create, :team_id => @team.id, :person => new_person_hash
        end

        it 'returns http success' do
          expect(response).to be_success
        end
        it 'sets flash error' do
          expect(flash[:error]).to_not be_nil
          #expect(flash[:error].detect { |val| val.is_a? Hash }).to include param
        end
      end
    end
  end
end
