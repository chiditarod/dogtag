require 'spec_helper'

describe PasswordResetsController do

  context '[logged out]' do

    shared_examples 'perishable token not found in db' do
      before do
        expect(User).to receive(:find_using_perishable_token).and_return(nil)
        endpoint.call
      end

      it 'sets flash error' do
        expect(flash[:error]).to eq("We're sorry, but we could not locate your account")
      end
      it 'redirects to home' do
        expect(response).to redirect_to(home_url)
      end
    end

    shared_examples 'assigns the user object' do
      it 'assigns the user object' do
        expect(assigns(:user)).to eq(user)
      end
    end

    describe '#new' do
      before do
        get :new
      end

      it 'renders 200' do
        expect(response).to be_success
      end
      it 'renders #new' do
        expect(request).to render_template(:new)
      end
    end

    describe '#edit' do

      context 'when perishable_token does not find a user' do
        let(:endpoint) { lambda { get :edit, id: '12345' } }
        include_examples 'perishable token not found in db'
      end

      context 'when perishable_token is in db' do
        let(:user) { double('user').as_null_object }
        before do
          expect(User).to receive(:find_using_perishable_token).and_return(user)
          get :edit, id: '12345'
        end

        include_examples 'assigns the user object'

        it 'renders 200' do
          expect(response).to be_success
        end
        it 'renders #edit' do
          expect(request).to render_template(:edit)
        end
      end
    end

    describe '#update' do

      context 'when perishable_token does not find a user' do
        let(:endpoint) { lambda { patch :update, id: '12345' } }
        include_examples 'perishable token not found in db'
      end

      context 'when perishable_token is in db' do
        before do
          expect(User).to receive(:find_using_perishable_token).and_return(user)
          endpoint.call
        end

        context 'when new password and confirmation are blank' do
          let(:user) { FactoryGirl.create :user }
          let(:endpoint) { lambda { patch :update, id: user.id, password: '', password_confirmation: '' } }

          it 'sets flash error' do
            expect(flash[:error]).to eq('Ensure you supply a new password and confirmation')
          end
          it 'renders 200' do
            expect(response).to be_success
          end
          it 'renders #edit' do
            expect(request).to render_template(:edit)
          end
          include_examples 'assigns the user object'
        end

        context 'when new password is accepted' do
          let(:user) { double('user', id: '12345', save: true).as_null_object }
          let(:endpoint) { lambda { patch :update, id: user.id, password: 'foo', password_confirmation: 'foo' } }

          it 'logs the user in automatically'

          it 'sets flash success' do
            expect(flash[:notice]).to eq("Your password was successfully updated")
          end
          it 'redirects to user page' do
            expect(response).to redirect_to(user_url(user.id))
          end
          include_examples 'assigns the user object'
        end

        context 'when new password is not accepted' do
          let(:errors) { double('errors', messages: 'foo') }
          let(:user) { double('user', id: '12345', save: false, errors: errors).as_null_object }
          let(:endpoint) { lambda { patch :update, id: user.id, password: 'foo', password_confirmation: 'foo' } }

          it 'sets flash error' do
            expect(flash[:error]).to eq('foo')
          end
          it 'renders 200' do
            expect(response).to be_success
          end
          it 'renders #edit' do
            expect(request).to render_template(:edit)
          end
          include_examples 'assigns the user object'
        end
      end
    end

    describe '#create' do

      context 'when user is not found' do
        let(:user) { double('user', email: 'foo').as_null_object }
        before do
          expect(User).to receive(:find_by_email).and_return(nil)
          post :create, email: user.email
        end

        it 'does not assign user' do
          expect(assigns(:user)).to be_nil
        end
        it 'sets flash error' do
          expect(flash[:error]).to eq("No user was found with email address: foo")
        end
        it 'responds 400' do
          expect(response.code).to eq('400')
        end
        it 'renders #new' do
          expect(request).to render_template(:new)
        end
      end

      context 'when user is found' do
        let(:user) { double('user', email: 'foo@bar.com').as_null_object }
        before do
          expect(User).to receive(:find_by_email).and_return(user)
          post :create, email: user.email
        end

        it 'delivers instructions' do
          expect(user).to have_recieved(:deliver_password_reset_instructions!)
        end
        it 'sets flash notice' do
          expect(flash[:notice]).to eq("Instructions to reset your password have been emailed to you")
        end
        it 'redirects to home' do
          expect(response).to redirect_to(home_url)
        end
      end
    end
  end

  context '[logged in]' do
    before do
      @valid_user = FactoryGirl.create :user
      activate_authlogic
      mock_login! @valid_user
    end

    shared_examples 'logged in behavior' do
      it 'sets flash notice' do
        expect(flash[:notice]).to eq('You must be logged out to access this page')
      end
      it 'redirects to account_path' do
        expect(response).to redirect_to(account_url)
      end
    end

    describe '#update' do
      before { patch :update, id: '12345' }
      include_examples 'logged in behavior'
    end

    describe '#create' do
      before { post :create }
      include_examples 'logged in behavior'
    end

    describe '#edit' do
      before { get :edit, id: '12345' }
      include_examples 'logged in behavior'
    end

    describe '#new' do
      before { get :new }
      include_examples 'logged in behavior'
    end
  end
end
